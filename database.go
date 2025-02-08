package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/go-sql-driver/mysql"
)

var (
    MainDB *sql.DB
    DB_CONFIG_PATH = filepath.Join(CONFIG_DIR, "db_config.json")
)

type DatabaseConfig map[string]interface{}
type DatabaseInfo map[string]interface{}

func ReadDatabaseConfig() (DatabaseConfig, error) {
	byteValue, err := os.ReadFile(DB_CONFIG_PATH)
	if err != nil {
		return nil, err
	}

	var results map[string]interface{} = make(map[string]interface{})
	if err := json.Unmarshal(byteValue, &results); err != nil {
        return nil, err
    }

    return results, nil
}

func ReadDatabaseInfo(key string) (DatabaseInfo, error) {
    config, err := ReadDatabaseConfig()
    if err != nil {
        return nil, err
    }

    return GetDatabaseInfo(config, key)
}

func GetDatabaseInfo(config DatabaseConfig, key string) (DatabaseInfo, error) {
    databases, ok := config["databases"].(map[string]interface{})
    if !ok {
        return nil, nil
    }

    info, ok := databases[key]
    if ok {
        return info.(map[string]interface{}), nil
    }
    return nil, nil
}

func DatabaseConnect(key string) (*sql.DB, error) {
    var (
        driverName string
        user string
        password string
        host string
        databaseName string
    )

    config, err := ReadDatabaseConfig()
    if err != nil {
        return nil, err
    }

    driverName = config["driver"].(string)
    user = config["user"].(string)
    password = config["password"].(string)
    host = config["host"].(string)
    
    databaseInfo, err := GetDatabaseInfo(config, key)
    if err != nil {
        return nil, err
    } else if databaseInfo == nil {
        databaseName = key
    } else {
        name, ok := databaseInfo["name"]
        if ok {
            databaseName = name.(string)
        } else {
            databaseName = key
        }
    }

    //cite: https://stackoverflow.com/a/45040724
	db, err := sql.Open(driverName, fmt.Sprintf("%s:%s@%s/%s?parseTime=true", user, password, host, databaseName))
	if err != nil {
		return nil, err
	}
	return db, nil
}

func UpdateSessionLogin(sessionId string, accountId int64) error {
    var loginId int64
    row := MainDB.QueryRow("SELECT id from logins WHERE session_id=?", sessionId)
    err := row.Scan(&loginId)
    if err == sql.ErrNoRows {
        _, err = MainDB.Exec("INSERT INTO logins (session_id, account_id) VALUES(?, ?)", sessionId, accountId)
        return err
    } else if err != nil {
        return err
    }
    _, err = MainDB.Exec("UPDATE logins SET account_id=? WHERE session_id=?", accountId, sessionId)
    return err
}
