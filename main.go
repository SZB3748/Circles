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
	if err := StartServer("127.0.0.1", 8080); err != nil {
		panic(err)
	}
}