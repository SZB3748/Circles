package main

import (
	"database/sql"
	"html"
	"html/template"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/securecookie"
	"github.com/gorilla/sessions"
	"github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/labstack/gommon/log"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

var (
	App *echo.Echo = echo.New()
	cookieStore sessions.CookieStore
	SessionIds map[string]time.Time = make(map[string]time.Time)
	SessionIdsLock sync.Mutex

	SECRET_PATH = filepath.Join(CONFIG_DIR, "secret.txt")
	MEDIA_DIR = filepath.Join(DIR, "media")
	STATIC_DIR = filepath.Join(DIR, "static")
	CRAWLERS_DIR = filepath.Join(DIR, "crawlers")
)

const (
	USERNAME_ALLOWED = "abcdefghijklmnopqrstuvwxyz0123456789"
	USERNAME_SYMBOLS = "-_."
	SERVER_SESSION_NAME = "session"
	SERVER_SESSION_ID = "id"
)

//TODO get circle's parents
/*
WITH RECURSIVE rec AS (
  SELECT id, parent_id, 0 AS depth FROM circles
  WHERE id=? --starting point
  UNION ALL SELECT c.id, c.parent_id, (r.depth+1) FROM circles c JOIN rec r ON c.id = r.parent_id
) SELECT parent_id, depth FROM rec WHERE parent_id IS NOT NULL ORDER BY depth ASC; --nearest to furthest
*/

func RouteIndex(c echo.Context) error {
	return c.Render(http.StatusOK, "index.html", nil)
}

func RouteLogin(c echo.Context) error {
	return c.Render(http.StatusOK, "login.html", nil)
}

func RouteLoginPost(c echo.Context) error {
	sessionId, err := GetSessionId(c)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Session ID missing.")
	}
	username := c.FormValue("username")	
	password := c.FormValue("password")
	if len(username) < 1 || len(password) < 1 {
		return echo.NewHTTPError(http.StatusBadRequest, "Missing form values: \"username\", \"password\"")
	}

	var (
		accountId int64
		passwd []byte
	)
	row := MainDB.QueryRow("SELECT id, passwd FROM accounts WHERE username=?", username)
	if err := row.Scan(&accountId, &passwd); err != nil {
		if err == sql.ErrNoRows {
			return c.Render(http.StatusOK, "login.html", map[string]string{"Error":"Invalid username."})
		}
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInsufficientStorage, "Failed to find user")
	}

	if bcrypt.CompareHashAndPassword(passwd, []byte(password)) == nil {
		UpdateSessionLogin(sessionId, accountId)
	} else {
		return c.Render(http.StatusOK, "login.html", map[string]string{"Error":"Invalid password."})
	}
	return c.Redirect(http.StatusSeeOther, "/@")
}

func RouteSignup(c echo.Context) error {
	return c.Render(http.StatusOK, "signup.html", map[string]string{"UsernameError":"","PasswordError":"","GeneralError":""})
}

func validateUsername(username string) bool {
	l := len(username)
	if l < 2 || l > 32 {
		return false
	}
	check := strings.ToLower(username)
	lastWasSymbol := false
	for i := 1; i < l; i++ {
		b := check[i]
		if strings.IndexByte(USERNAME_SYMBOLS, b) > -1 {
			if (lastWasSymbol) {
				return false
			}
			lastWasSymbol = true
		} else if strings.IndexByte(USERNAME_ALLOWED, b) < 0 {
			return false
		} else if lastWasSymbol {
			lastWasSymbol = false
		}
	}
	return !lastWasSymbol
}

func RouteSignupPost(c echo.Context) error {
	sessionId, err := GetSessionId(c)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Session ID missing.")
	}
	username := c.FormValue("username")
	password := c.FormValue("password")
	lp := len(password)
	if len(username) < 1 || lp < 1 {
		return echo.NewHTTPError(http.StatusBadRequest, "Missing form values: \"username\", \"password\"")
	} else if !validateUsername(username) {
		return c.Render(http.StatusOK, "signup.html", map[string]string{"Error":"This username is invalid."})
	} else if lp < 8 || lp > 64 {
		return c.Render(http.StatusOK, "signup.html", map[string]string{"Error":"This password is invalid."})
	}

	var rowId int64
	row := MainDB.QueryRow("SELECT id FROM accounts WHERE username=?", username)
	err = row.Scan(&rowId)
	if err == nil {
		//username already exists
		return c.Render(http.StatusOK, "signup.html", map[string]string{"Error":"This username already exists."})
	} else if err != sql.ErrNoRows {
		//other error
		c.Logger().Error(err)
		return c.Render(http.StatusOK, "signup.html", map[string]string{"Error":"Failed to check if username is in use."})
	}

	passwd, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		c.Logger().Error(err)
		return c.Render(http.StatusOK, "signup.html", map[string]string{"Error":"Failed to process account info."})
	}

	_, err = MainDB.Exec("INSERT INTO accounts (username, displayname, pfp, bio, passwd) VALUES(?, NULL, \"default_pfp.png\", \"\", ?)", username, passwd)
	if err != nil {
		c.Logger().Error(err)
		return c.Render(http.StatusOK, "signup.html", map[string]string{"Error":"Failed to add account."})
	}
	var accountId int64
	row = MainDB.QueryRow("SELECT id FROM accounts WHERE username=?", username)
	err = row.Scan(&accountId)
	if err != nil {
		c.Logger().Error(err)
		return c.Render(http.StatusOK, "signup.html", map[string]string{"Error":"Failed to add account."})
	}
	UpdateSessionLogin(sessionId, accountId)
	
	//TODO redirect to a landing page to further customize account (display name, pfp, bio)
	return c.Redirect(http.StatusFound, App.Reverse("Index"))
}

func RouteAccount(c echo.Context) error {
	sessionId, err := GetSessionId(c)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Session ID missing.")
	}
	var (
		accountId int64
		isMine bool
		displayname *string
		pfp string
		bio string
	)
	row := MainDB.QueryRow("SELECT account_id FROM logins WHERE session_id=?", sessionId)
	if err := row.Scan(&accountId); err != nil {
		if err != sql.ErrNoRows {
			c.Logger().Error(err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user")
		}
		isMine = false
	} else {
		isMine = true
	}

	accountName := c.Param("name")
	if len(accountName) < 1 {
		if !isMine {
			return c.Redirect(http.StatusFound, App.Reverse("Login"))
		}
		row = MainDB.QueryRow("SELECT username, displayname, pfp, bio FROM accounts WHERE id=?", accountId)
	} else {
		row = MainDB.QueryRow("SELECT username, displayname, pfp, bio FROM accounts WHERE username=?", accountName)
	}
	if err := row.Scan(&accountName, &displayname, &pfp, &bio); err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "User not found")
		}
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user")
	}
	var bioFinal template.HTML
	if len(bio) > 0 {
		builder := strings.Builder{}
		bioLines := strings.Split(bio, "\n")
		size := len(bioLines) * 7
		for _, line := range bioLines {
			size += len(line)
		}
		builder.Grow(size)
		for _, line := range bioLines {
			builder.WriteString("<p>")
			builder.WriteString(html.EscapeString(line))
			builder.WriteString("</p>")
		}
		bioFinal = template.HTML(builder.String())
	} else {
		bioFinal = ""
	}
	return c.Render(http.StatusOK, "account.html", map[string]interface{}{
		"Name": accountName,
		"DisplayName": displayname,
		"Icon": pfp,
		"Bio": bioFinal,
		"BioRaw": bio,
		"IsMine": isMine,
	})
}

func GetSession(c echo.Context) (*sessions.Session, error) {
	return session.Get(SERVER_SESSION_NAME, c)
}

func GetSessionId(c echo.Context) (string, error) {
	sess, err := GetSession(c)
	if err != nil {
		return "", err
	}
	return sess.Values[SERVER_SESSION_ID].(string), nil
}

func ApplySessionId(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		sess, err := GetSession(c)
		if err != nil {
			c.Error(err)
			return err
		}
		oidAny, ok := sess.Values[SERVER_SESSION_ID]
		//if session is new (no ID)
		if !ok {
			//take the opportunity to check all the
			//sessions and clear out any old ones
			//DeleteExpiredSessions(sess, float64(sess.Options.MaxAge)) //TODO

			//create new session for this request

			id := uuid.New().String()
			sess.Values[SERVER_SESSION_ID] = id

			//save session
			if err = sess.Save(c.Request(), c.Response()); err != nil {
				c.Error(err)
				return err
			}

			c.Logger().Infof("NEW SESSION: %s", id)

			SessionIdsLock.Lock()
			sess.Options = cookieStore.Options
			SessionIds[id] = time.Now()
			SessionIdsLock.Unlock()

		} else if oid, ok := oidAny.(string); ok {
			SessionIdsLock.Lock()
			_, ok := SessionIds[oid]
			if !ok {
				c.Logger().Infof("OLD SESSION: %s", oid)
				SessionIds[oid] = time.Now()
			}
			SessionIdsLock.Unlock()
		}
		return next(c)
	}
}

func PrepareTemplates() error {
	renderer := NewTemplateRenderer()
	base := NewTemplateSource("base.html", filepath.Join(TEMPLATES_DIR, "base.html"))
	index := NewTemplateSource("index.html", filepath.Join(TEMPLATES_DIR, "index.html"), base)
	account := NewTemplateSource("account.html", filepath.Join(TEMPLATES_DIR, "account.html"), base)
	login := NewTemplateSource("login.html", filepath.Join(TEMPLATES_DIR, "login.html"), base)
	signup := NewTemplateSource("signup.html", filepath.Join(TEMPLATES_DIR, "signup.html"), base)
	renderer.Add(base, index, account, login, signup)
	err := renderer.UpdateDependecies()
	if err != nil {
		return err
	}
	App.Renderer = renderer
	return nil
}

func BindRoutes() error {
	App.Use(
		middleware.Logger(),
		middleware.Recover(),
		session.Middleware(&cookieStore),
		ApplySessionId,
	)
	
	App.Static("/static", STATIC_DIR)
	App.Static("/media", MEDIA_DIR)
	App.File("/robots.txt", filepath.Join(CRAWLERS_DIR, "robots.txt"))
	App.GET("/", RouteIndex).Name = "Index"
	App.GET("/@", RouteAccount)
	App.GET("/@:name", RouteAccount)
	App.GET("/login", RouteLogin).Name = "Login"
	App.POST("/login", RouteLoginPost)
	App.GET("/signup", RouteSignup)
	App.POST("/signup", RouteSignupPost)
	return nil
}

func Serve(host string, port int) error {
	h2s := http2.Server{
		MaxConcurrentStreams: 250,
		MaxReadFrameSize: 1048576,
		IdleTimeout: 10 * time.Second,
	}
	s := http.Server{
		Addr: host + ":" + strconv.FormatInt(int64(port), 10),
		Handler: h2c.NewHandler(App, &h2s),
	}
	if err := s.ListenAndServe(); err != http.ErrServerClosed {
		return err
	}
	return nil
}

func StartServer(host string, port int) error {

	App.Logger.SetLevel(log.INFO)
	secretBytes, err := os.ReadFile(SECRET_PATH)
	if err != nil {
		return err
	}
	cookieStore = sessions.CookieStore{
		Codecs: securecookie.CodecsFromPairs(secretBytes),
		Options: &sessions.Options{
			Path:     "/",
			MaxAge:   2592000, //86400 * 30 = 30 days in seconds
		},
	}
	cookieStore.MaxAge(cookieStore.Options.MaxAge)

	err = PrepareTemplates()
	if err != nil {
		return err
	}
	err = BindRoutes()
	if err != nil {
		return err
	}
	return Serve(host, port)
}