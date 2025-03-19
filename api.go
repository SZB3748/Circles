package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

//TODO limit info provied based on permissions

var ApiGroup *echo.Group = App.Group("/api")

func getContextIds(c echo.Context) (string, AccountId, error) {
	sessionId, err := GetSessionId(c)
	if err != nil {
		c.Logger().Error(err)
		return "", 0, echo.NewHTTPError(http.StatusInternalServerError, "Session ID missing.")
	}
	row := MainDB.QueryRow("SELECT account_id FROM logins WHERE session_id=?", sessionId)
	var accountId AccountId
	if err := row.Scan(&accountId); err != nil {
		if err == sql.ErrNoRows {
			return "", 0, c.Redirect(http.StatusFound, App.Reverse("Login"))
		}
		c.Logger().Error(err)
		return "", 0, echo.NewHTTPError(http.StatusInternalServerError, "Failed to get account status.")
	}

	return sessionId, accountId, nil
}

func collectCircleData(info *CircleInfo) map[string]interface{} {
	defaultSubcirclePermissions := make(map[string]interface{}, len(info.DefaultSubcirclePermissions))
	for number, granted := range info.DefaultSubcirclePermissions {
		p := PERMS_ALL[number-1]
		defaultSubcirclePermissions[p.Name] = map[string]interface{}{
			"display_name": p.DisplayName,
			"granted": granted,
		}
	}
	circleData := map[string]interface{}{
		"id": info.Id,
		"parent_id": info.ParentId,
		"owner_id": info.OwnerId,
		"name": info.Name,
		"created": info.Created.Format(time.RFC3339),
		"com_type": info.ComType,
		"default_subcircle": map[string]interface{}{
			"com_type": info.DefaultSubcircleComType,
			"permissions": defaultSubcirclePermissions,
		},
	}
	return circleData
}

//GET /api/circle/:circle/parent
func RouteApiCircleParent(c echo.Context) error {
	_, _, err := getContextIds(c)
	if err != nil {
		return err
	}

	cirlceIdString := c.Param("circle")
	circleId, err := strconv.ParseInt(cirlceIdString, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnprocessableEntity, "Circle ID must be an integer.")
	}

	info := &CircleInfo{}
	var rawDefaultSubcirclePermissions []byte
	row := MainDB.QueryRow(
		`SELECT id, parent_id, owner_id, name, created, com_type, default_subcircle_com_type, default_subcircle_permissions FROM circles c
			WHERE EXISTS(SELECT 1 FROM circles c2 WHERE c2.id=? AND c2.parent_id<>NULL AND c.id=c2.parent_id)`,
		circleId,
	)
	if err := row.Scan(&info.Id, &info.ParentId, &info.OwnerId, &info.Name, &info.Created, &info.ComType, &info.DefaultSubcircleComType, &rawDefaultSubcirclePermissions); err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Circle has not parent.")
		}
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find circle parent.")
	}
	info.DefaultSubcirclePermissions = PermissionsFromBytes(rawDefaultSubcirclePermissions)
	
	circleData := collectCircleData(info)
	jsonData, err := json.Marshal(circleData)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to format circle data.")
	}
	return c.JSONBlob(http.StatusOK, jsonData)
}

//GET /api/circle/:circle/parents
func RouteApiCircleParents(c echo.Context) error {
	_, _, err := getContextIds(c)
	if err != nil {
		return err
	}

	cirlceIdString := c.Param("circle")
	circleId, err := strconv.ParseInt(cirlceIdString, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnprocessableEntity, "Circle ID must be an integer.")
	}

	parents, err := GetAllCircleParents(circleId)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get all circle parents.")
	} else if parents == nil {
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	}
	parentsOrderMap := make(map[CircleId]int, len(parents))
	for i, parentId := range parents {
		parentsOrderMap[parentId] = i
	}

	parentIdSet := idSetString(parents)
	queryString := "SELECT id, parent_id, owner_id, name, created, com_type, default_subcircle_com_type, default_subcircle_permissions FROM circles WHERE id IN " + parentIdSet
	rows, err := MainDB.Query(queryString)
	if err == sql.ErrNoRows {
		c.Logger().Warnf("Parent IDs for circle %d could not be found.", circleId)
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	} else if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get circle parent info.")
	}
	defer rows.Close()

	circleDatas := make([]map[string]interface{}, len(parents))
	for rows.Next() {
		info := &CircleInfo{}
		var rawDefaultSubcirclePermissions []byte
		if err := rows.Scan(&info.Id, &info.ParentId, &info.OwnerId, &info.Name, &info.Created, &info.ComType, &info.DefaultSubcircleComType, &rawDefaultSubcirclePermissions); err != nil {
			c.Logger().Error(err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get parent info.")
		}
		info.DefaultSubcirclePermissions = PermissionsFromBytes(rawDefaultSubcirclePermissions)
		circleData := collectCircleData(info)
		circleDatas[parentsOrderMap[info.Id]] = circleData
	}

	jsonData, err := json.Marshal(circleDatas)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to format circle parents data.")
	}
	return c.JSONBlob(http.StatusOK, jsonData)
}

//GET /api/circle/:circle/children
func RouteApiCircleChildren(c echo.Context) error {
	_, _, err := getContextIds(c)
	if err != nil {
		return err
	}

	cirlceIdString := c.Param("circle")
	circleId, err := strconv.ParseInt(cirlceIdString, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnprocessableEntity, "Circle ID must be an integer.")
	}

	rows, err := MainDB.Query("SELECT id, owner_id, name, created, com_type, default_subcircle_com_type, default_subcircle_permissions FROM circles WHERE parent_id=?", circleId)
	if err == sql.ErrNoRows {
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	} else if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get child circle info.")
	}
	defer rows.Close()

	circleDatas := make([]map[string]interface{}, 0)
	for rows.Next() {
		info := &CircleInfo{ParentId: &circleId}
		var rawDefaultSubcirclePermissions []byte
		if err := rows.Scan(&info.Id, &info.OwnerId, &info.Name, &info.Created, &info.ComType, &info.DefaultSubcircleComType, &rawDefaultSubcirclePermissions); err != nil {
			c.Logger().Error(err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get child circle info.")
		}
		info.DefaultSubcirclePermissions = PermissionsFromBytes(rawDefaultSubcirclePermissions)
		circleData := collectCircleData(info)
		circleDatas = append(circleDatas, circleData)
	}

	jsonData, err := json.Marshal(circleDatas)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to format circle children data.")
	}
	return c.JSONBlob(http.StatusOK, jsonData)
}

//GET /api/circle/:circle/hierarchy
func RouteApiCircleHierarchy(c echo.Context) error {
	_, _, err := getContextIds(c)
	if err != nil {
		return err
	}

	cirlceIdString := c.Param("circle")
	circleId, err := strconv.ParseInt(cirlceIdString, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnprocessableEntity, "Circle ID must be an integer.")
	}

	parents, err := GetAllCircleParents(circleId)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get all circle parents.")
	} else if parents == nil {
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	}
	parentsOrderMap := make(map[CircleId]int, len(parents))
	for i, parentId := range parents {
		parentsOrderMap[parentId] = i
	}

	parentIdSet := idSetString(parents)
	queryString := "SELECT id, parent_id, owner_id, name, created, com_type, default_subcircle_com_type, default_subcircle_permissions FROM circles WHERE id IN " + parentIdSet
	rowsParents, err := MainDB.Query(queryString)
	if err == sql.ErrNoRows {
		c.Logger().Warnf("Parent IDs for circle %d could not be found.", circleId)
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	} else if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get circle parent info.")
	}
	defer rowsParents.Close()

	rowsChildren, err := MainDB.Query("SELECT id, owner_id, name, created, com_type, default_subcircle_com_type, default_subcircle_permissions FROM circles WHERE parent_id=?", circleId)
	if err == sql.ErrNoRows {
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	} else if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get child circle info.")
	}
	defer rowsChildren.Close()

	parentsDatas := make([]map[string]interface{}, len(parents))
	for rowsParents.Next() {
		info := &CircleInfo{}
		var rawDefaultSubcirclePermissions []byte
		if err := rowsParents.Scan(&info.Id, &info.ParentId, &info.OwnerId, &info.Name, &info.Created, &info.ComType, &info.DefaultSubcircleComType, &rawDefaultSubcirclePermissions); err != nil {
			c.Logger().Error(err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get parent info.")
		}
		info.DefaultSubcirclePermissions = PermissionsFromBytes(rawDefaultSubcirclePermissions)
		circleData := collectCircleData(info)
		parentsDatas[parentsOrderMap[info.Id]] = circleData
	}

	childrenDatas := make([]map[string]interface{}, 0)
	for rowsChildren.Next() {
		info := &CircleInfo{ParentId: &circleId}
		var rawDefaultSubcirclePermissions []byte
		if err := rowsChildren.Scan(&info.Id, &info.OwnerId, &info.Name, &info.Created, &info.ComType, &info.DefaultSubcircleComType, &rawDefaultSubcirclePermissions); err != nil {
			c.Logger().Error(err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get child circle info.")
		}
		info.DefaultSubcirclePermissions = PermissionsFromBytes(rawDefaultSubcirclePermissions)
		circleData := collectCircleData(info)
		childrenDatas = append(childrenDatas, circleData)
	}

	hierarchyData := map[string][]map[string]interface{}{
		"parents": parentsDatas,
		"children": childrenDatas,
	}

	jsonData, err := json.Marshal(hierarchyData)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to format chircle hierarchy data.")
	}
	return c.JSONBlob(http.StatusOK, jsonData)
}

//GET /api/circle/:circle/roles
func RouteApiCircleRoles(c echo.Context) error {
	_, accountId, err := getContextIds(c)
	if err != nil {
		return err
	}
	
	cirlceIdString := c.Param("circle")
	circleId, err := strconv.ParseInt(cirlceIdString, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnprocessableEntity, "Circle ID must be an integer.")
	}
	roles, err := GetAccountRolesInfo(accountId, circleId)
	if roles == nil {
		if err != nil {
			c.Logger().Error(err)
		} else {
			c.Logger().Warnf("Account %d has no roles in circle %d", accountId, circleId)
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get account roles.")
	}

	roleData := make(map[string]map[string]interface{}, len(roles))
	for _, role := range roles {
		colorStr := fmt.Sprintf("%02x%02x%02x", role.Color[0], role.Color[1], role.Color[2])
		roleData[role.Name] = map[string]interface{}{
			"circle_id": role.CircleId,
			"order": role.Order,
			"name": role.Name,
			"color": colorStr,
		}
	}

	jsonData, err := json.Marshal(roleData)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to format role data.")
	}
	return c.JSONBlob(http.StatusOK, jsonData)
}

//GET /api/circle/:circle/roles/permissions?names
func RouteApiCircleRolesPermissions(c echo.Context) error {
	_, accountId, err := getContextIds(c)
	if err != nil {
		return err
	}
	
	cirlceIdString := c.Param("circle")
	circleId, err := strconv.ParseInt(cirlceIdString, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnprocessableEntity, "Circle ID must be an integer.")
	}
	roles, err := GetAccountRoles(accountId, circleId)
	if roles == nil {
		if err != nil {
			c.Logger().Error(err)
		} else {
			c.Logger().Warnf("Account %d has no roles in circle %d", accountId, circleId)
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get account roles.")
	}
	permissionsString := c.QueryParam("names")
	var permissionList PermissionsList
	if len(permissionsString) > 0 {
		permissionStrings := strings.Split(permissionsString, "+")
		permissionNumbers := make([]PermissionNumber, len(permissionStrings))
		for i, pstr := range permissionStrings {
			pname := strings.TrimSpace(strings.ToLower(pstr))
			if p, ok := PERMS_NAME_MAP[pname]; ok {
				permissionNumbers[i] = p.Number
			} else {
				return echo.NewHTTPError(http.StatusUnprocessableEntity, "Bad permission name: " + pname)
			}
		}
		permissionList, err = GetSomePermissions(circleId, roles, permissionNumbers)
	} else {
		permissionList, err = GetAllPermissions(circleId, )
	}

	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get list of permissions.")
	}

	permissionData := make(map[string]map[string]interface{}, len(permissionList))
	for n, granted := range permissionList {
		p := PERMS_ALL[n-1]
		permissionData[p.Name] = map[string]interface{}{
			"display_name": p.DisplayName,
			"granted": granted,
		}
	}

	jsonData, err := json.Marshal(permissionData)
	if err != nil {
		c.Logger().Error(err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to format permission data.")
	}
	return c.JSONBlob(http.StatusOK, jsonData)
}
