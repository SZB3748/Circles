package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"math/rand"
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

	MEDIA_FILE_RCOUNT int = 36
	MEDIA_FILE_NAME_RANGE = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_"
)

//TODO get circle's parents
/*
WITH RECURSIVE rec AS (
  SELECT id, parent_id, 0 AS depth FROM circles
  WHERE id=? --starting point
  UNION ALL SELECT c.id, c.parent_id, (r.depth+1) FROM circles c JOIN rec r ON c.id = r.parent_id
) SELECT parent_id, depth FROM rec WHERE parent_id IS NOT NULL ORDER BY depth ASC; --nearest to furthest
*/

func CreateMediaFile(ext string, src io.Reader) (string, error) {
	builder := strings.Builder{}
	size := MEDIA_FILE_RCOUNT + len(ext) + 1
	builder.Grow(size)
	l := len(MEDIA_FILE_NAME_RANGE)
	for i := 0; i < MEDIA_FILE_RCOUNT; i++ {
		builder.WriteByte(MEDIA_FILE_NAME_RANGE[rand.Intn(l)])
	}
	builder.WriteByte('.')
	builder.WriteString(ext)
	
	name := builder.String()

	file, err := os.OpenFile(filepath.Join(MEDIA_DIR, name), os.O_RDWR|os.O_CREATE|os.O_EXCL, 0666)
	if err != nil {
		return name, err
	}
	defer file.Close()

	_, err = io.Copy(file, src)
	return name, err
}

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
	return c.Render(http.StatusOK, "account.html", map[string]interface{}{
		"Name": accountName,
		"NoDisplayName": displayname == nil,
		"DisplayName": displayname,
		"Icon": pfp,
		"Bio": bio,
		"IsMine": isMine,
	})
}

func RouteAccountEdit(c echo.Context) error {
	name := c.Param("name")

	row := MainDB.QueryRow("SELECT id FROM accounts WHERE username=?", name)
	var accountId int64
	if err := row.Scan(&accountId); err != nil {
		if err == sql.ErrNoRows {
			b := strings.Builder{}
			b.Grow(21 + len(name))
			b.WriteString("User ")
			b.WriteString(name)
			b.WriteString(" does not exist.")
			return echo.NewHTTPError(http.StatusNotFound, b.String())
		}
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed")
	}

	c.Request().ParseForm()
	
	hasIcon := true
	iconFile, err := c.FormFile("pfp")
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) {
			hasIcon = false
		} else {
			c.Logger().Error(err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load profile picture submission info.")
		}
	}

	attrs := make([]string, 0)
	values := make([]interface{}, 0)
	stmtSize := 31

	if usernameAll, ok := c.Request().PostForm["username"]; ok && len(usernameAll) > 0 && name != usernameAll[0] {
		username := usernameAll[0]
		if !validateUsername(username) {
			return echo.NewHTTPError(http.StatusUnprocessableEntity, "Invalid username.")
		}
		row := MainDB.QueryRow("SELECT id FROM accounts WHERE username=?", username)
		var id int64;
		err := row.Scan(&id)
		if err == nil {
			return echo.NewHTTPError(http.StatusForbidden, "This username already exists.")
		} else if err != sql.ErrNoRows {
			c.Logger().Error(err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to validate username.")
		}

		attrs = append(attrs, "username")
		values = append(values, username)
		stmtSize += len("username")+2
	}
	if displaynameAll, ok := c.Request().PostForm["displayname"]; ok && len(displaynameAll) > 0 {
		displayname := displaynameAll[0]
		l := len(displayname)
		if l == 1 || l > 32 {
			return echo.NewHTTPError(http.StatusUnprocessableEntity, "Invalid display name.")
		}
		attrs = append(attrs, "displayname")
		if l < 1 {
			values = append(values, nil)
		} else {
			values = append(values, displayname)
		}
		stmtSize += len("displayname")+2
	}
	if bioAll, ok := c.Request().PostForm["bio"]; ok && len(bioAll) > 0 {

		bio := strings.ReplaceAll(strings.TrimSpace(bioAll[0]), "\r", "")
		l := len(bio)
		if strings.Contains(bio, "\n\n") {
			builder := strings.Builder{}
			builder.Grow(l/2)
			lastWasNewline := false
			for i := 0; i < l; i++ {
				c := bio[i]
				if c == '\n' {
					if lastWasNewline || i == l-1 {
						continue
					}
					lastWasNewline = true
				} else if lastWasNewline {
					lastWasNewline = false
				}
				builder.WriteByte(c)
			}
			bio = builder.String()
		}

		if len(bio) > 400 {
			return echo.NewHTTPError(http.StatusUnprocessableEntity, "Invalid bio.")
		}
		attrs = append(attrs, "bio")
		values = append(values, bio)
		stmtSize += len("bio")+2
	}
	iconName := ""
	if hasIcon {
		iconExtIndex := strings.IndexByte(iconFile.Filename, '.')
		if iconExtIndex < 0 {
			return echo.NewHTTPError(http.StatusUnprocessableEntity, "Unknown file type.")
		}
		iconExt := iconFile.Filename[iconExtIndex+1:]
		iconSrc, err := iconFile.Open()
		if err != nil {
			c.Logger().Error(err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load profile picture submission.")
		}
		defer iconSrc.Close()

		iconName, err = CreateMediaFile(iconExt, iconSrc)
		if err != nil {
			c.Logger().Error(err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to save profile picture submission.")
		}

		attrs = append(attrs, "pfp")
		values = append(values, iconName)
		stmtSize += len("pfp")+2
	}

	if len(attrs) < 1 {
		return c.JSONBlob(http.StatusOK, []byte("{}"))
	}
	
	lenMin1 := len(attrs) - 1
	if lenMin1 > 0 {
		stmtSize += lenMin1
	}
	
	stmtBuilder := strings.Builder{}
	stmtBuilder.Grow(stmtSize)
	stmtBuilder.WriteString("UPDATE accounts SET ")
	for i := 0; i < lenMin1; i++ {
		stmtBuilder.WriteString(attrs[i])
		stmtBuilder.WriteString("=?,")
	}
	stmtBuilder.WriteString(attrs[lenMin1])
		stmtBuilder.WriteString("=?")
	stmtBuilder.WriteString(" WHERE id=?")

	values = append(values, accountId)

	_, err = MainDB.Exec(stmtBuilder.String(), values...)
	if err != nil {
		c.Logger().Error(err)
		if len(iconName) > 0 {
			if err := os.Remove(filepath.Join(MEDIA_DIR, iconName)); err != nil {
				c.Logger().Error(err)
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete upload.")
			}
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to make changes.")
	}

	newValues := make(map[string]interface{}, len(attrs))
	for i := 0; i < len(attrs); i++ {
		newValues[attrs[i]] = values[i]
	}
	jsonBlob, err := json.Marshal(newValues)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to format modified profile data.")
	}

	return c.JSONBlob(http.StatusOK, jsonBlob)
}

func RouteLogout(c echo.Context) error {
	sessionId, err := GetSessionId(c)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Session ID missing.")
	}
	_, err = MainDB.Exec("DELETE FROM logins WHERE session_id=?", sessionId)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to logout session.")
	}
	return c.NoContent(http.StatusOK)
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
	App.Static("/media", MEDIA_DIR).Name = "Media"
	App.File("/robots.txt", filepath.Join(CRAWLERS_DIR, "robots.txt"))
	App.GET("/", RouteIndex).Name = "Index"
	App.GET("/@", RouteAccount)
	App.GET("/@:name", RouteAccount)
	App.POST("/@:name/edit", RouteAccountEdit)
	App.GET("/login", RouteLogin).Name = "Login"
	App.POST("/login", RouteLoginPost)
	App.GET("/signup", RouteSignup)
	App.POST("/signup", RouteSignupPost)
	App.POST("/logout", RouteLogout)
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