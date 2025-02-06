package main

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gorilla/securecookie"
	"github.com/gorilla/sessions"
	"github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/labstack/gommon/log"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

var (
	App *echo.Echo = echo.New()
	cookieStore sessions.CookieStore

	SECRET_PATH = filepath.Join(CONFIG_DIR, "secret.txt")
	STATIC_DIR = filepath.Join(DIR, "static")
	CRAWLERS_DIR = filepath.Join(DIR, "crawlers")
)


func RouteIndex(c echo.Context) error {
	return c.Render(http.StatusOK, "index.html", nil)
}



func PrepareTemplates() error {
	renderer := NewTemplateRenderer()
	base := NewTemplateSource("base.html", filepath.Join(TEMPLATES_DIR, "base.html"))
	index := NewTemplateSource("index.html", filepath.Join(TEMPLATES_DIR, "index.html"), base)
	renderer.Add(base, index)
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
		//Server.ApplySessionId,
	)
	
	App.Static("/static", STATIC_DIR)
	App.File("/robots.txt", filepath.Join(CRAWLERS_DIR, "robots.txt"))
	App.GET("/", RouteIndex)
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