package main

import (
	"os"
	"path/filepath"
)

var (
	DIR = (func() string {
		var (
			path string
			err  error
		)
		if len(os.Args) > 1 {
			path, err = filepath.Abs(os.Args[1])
			if err != nil {
				panic(err)
			}
			return path
		}

		path, err = os.Executable()
		if err != nil {
			panic(err)
		}
		return filepath.Dir(path)
	})()

	CONFIG_DIR = filepath.Join(DIR, "config")
)

func main() {
	var err error

	MainDB, err = DatabaseConnect("main")
	if err != nil {
		panic(err)
	} else if err = MainDB.Ping(); err != nil {
		panic(err)
	}

	err = StartServer("127.0.0.1", 8080)
	if err != nil {
		panic(err)
	}
}