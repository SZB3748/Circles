package main

import (
	"database/sql"
	"encoding/binary"
	"strconv"
	"strings"
	"time"
)

type CircleId = int64
type CommunicationType = int8
type AccountId = int64
type MemberId = int64
type RoleId = int64
type PermissionNumber = int64

const (
	COM_TYPE_POST CommunicationType = 0
	COM_TYPE_MESSAGE CommunicationType = 1
)

type Permission struct {
	Name string
	DisplayName string
	Number PermissionNumber
}

type PermissionsList = map[PermissionNumber]bool

var (
	PERM_VIEW_CIRCLE = Permission{Name: "view_circle", DisplayName: "View Circle", Number: 1}
	PERM_CHANGE_CIRCLE_NAME = Permission{Name: "change_circle_name", DisplayName: "Change Circle Name", Number: 2}
	PERM_CREATE_SUBCIRCLE = Permission{Name: "create_subcircle", DisplayName: "Create Subcircle", Number: 3}
	PERM_DELETE_SUBCIRCLE = Permission{Name: "delete_subcircle", DisplayName: "Delete Subcircle", Number: 4}
	PERM_ALLOW_MD_HEADERS = Permission{Name: "allow_markdown_headers", DisplayName: "Allow Markdown Headers", Number: 5}
	PERM_ALLOW_MD_LINKS = Permission{Name: "allow_markdown_links", DisplayName: "Allow Markdown Links", Number: 6}
	PERM_ALLOW_MD_LISTS = Permission{Name: "allow_markdown_lists", DisplayName: "Allow Markdown Lists", Number: 7}
	PERM_ALLOW_MD_CODE = Permission{Name: "allow_markdown_code", DisplayName: "Allow Markdown Code", Number: 8}
	PERM_ALLOW_MD_CODE_BLOCK = Permission{Name: "allow_markdown_code_block", DisplayName: "Allow Markdown Code Block", Number: 9}
	PERM_ALLOW_MD_BOLD = Permission{Name: "allow_markdown_bold", DisplayName: "Allow Markdown Bold", Number: 10}
	PERM_ALLOW_MD_ITALIC = Permission{Name: "allow_markdown_italic", DisplayName: "Allow Markdown Italic", Number: 11}
	PERM_ALLOW_MD_UNDERSCORE = Permission{Name: "allow_markdown_underscore", DisplayName: "Allow Markdown Underscore", Number: 12}
	PERM_ALLOW_MD_STRIKE = Permission{Name: "allow_markdown_strikethrough", DisplayName: "Allow Markdown Strikethrough", Number: 13}
	PERM_ALLOW_MD_SPOILER = Permission{Name: "allow_markdown_spoiler", DisplayName: "Allow Markdown Spoiler", Number: 14}
	PERM_SEND_CONTENT = Permission{Name: "send_content", DisplayName: "Send Content", Number: 15}
	PERM_DELETE_CONTENT = Permission{Name: "delete_content", DisplayName: "Delete Content", Number: 16}
	PERM_DELETE_OWN_CONTENT = Permission{Name: "delete_own_content", DisplayName: "Delete Own Content", Number: 17}
	PERM_EDIT_OWN_CONTENT = Permission{Name: "edit_own_content", DisplayName: "Edit Own Content", Number: 18}
	PERM_REACT_CONTENT_NEW = Permission{Name: "react_content_new", DisplayName: "Add New Reactions to Content", Number: 19}
	PERM_REACT_CONTENT_ADD = Permission{Name: "react_content_add", DisplayName: "Add Reactions to Content", Number: 20}
	PERM_SEND_ATTACHMENTS = Permission{Name: "send_attachments", DisplayName: "Send Attachments", Number: 21}
	PERM_SEND_EMBEDS = Permission{Name: "send_embeds", DisplayName: "Send Links that Embed Content", Number: 22}
	PERM_EDIT_DEFAULT_SUBCIRCLE_COM_TYPE = Permission{Name: "edit_default_subcircle_communication_type", DisplayName: "Edit Default Subcircle Communication Type", Number: 23}
	PERM_EDIT_DEFAULT_SUBCIRCLE_PERMISSIONS = Permission{Name: "edit_default_subcircle_permissions", DisplayName: "Edit Default Subcircle Permissions", Number: 24}
	PERM_ADD_ROLE = Permission{Name: "add_role", DisplayName: "Add Role", Number: 25}
	PERM_DELETE_ROLE = Permission{Name: "delete_role", DisplayName: "Delete Role", Number: 26}
	PERM_EDIT_ROLE_PERMISSIONS = Permission{Name: "edit_role_permissions", DisplayName: "Edit Role Permissions", Number: 27}
	PERM_EDIT_ROLE_NAME = Permission{Name: "edit_role_name", DisplayName: "Edit Role Name", Number: 28}
	PERM_EDIT_ROLE_COLOR = Permission{Name: "edit_role_color", DisplayName: "Edit Role Color", Number: 29}
	PERM_EDIT_ROLE_MEMBERS = Permission{Name: "edit_role_members", DisplayName: "Edit Role Members", Number: 30}
	PERM_INVITE_CIRCLE_MEMBERS = Permission{Name: "invite_circle_members", DisplayName: "Invite Circle Members", Number: 31}
	PERM_REMOVE_CIRCLE_MEMBERS = Permission{Name: "remove_circle_members", DisplayName: "Remove Circle Members", Number: 32}
	PERM_BAN_CIRCLE_MEMBERS = Permission{Name: "ban_circle_members", DisplayName: "Ban Circle Members", Number: 33}
	PERM_MUTE_CIRCLE_MEMBERS = Permission{Name: "mute_circle_members", DisplayName: "Mute Circle Members", Number: 34}
    PERM_MENTION_EVERYONE = Permission{Name: "mention_everyone", DisplayName: "Mention @everyone"}

	PERMS_MANAGE_SUBCIRCLE = []Permission{PERM_CREATE_SUBCIRCLE, PERM_DELETE_SUBCIRCLE}
	PERMS_ALLOW_MARKDOWN = []Permission{PERM_ALLOW_MD_HEADERS, PERM_ALLOW_MD_LINKS, PERM_ALLOW_MD_LISTS, PERM_ALLOW_MD_CODE, PERM_ALLOW_MD_CODE_BLOCK, PERM_ALLOW_MD_BOLD, PERM_ALLOW_MD_ITALIC, PERM_ALLOW_MD_UNDERSCORE, PERM_ALLOW_MD_STRIKE, PERM_ALLOW_MD_SPOILER}
	PERMS_MANAGE_ROLES = []Permission{PERM_ADD_ROLE, PERM_DELETE_ROLE, PERM_EDIT_ROLE_PERMISSIONS, PERM_EDIT_ROLE_NAME, PERM_EDIT_ROLE_COLOR, PERM_EDIT_ROLE_MEMBERS}
	PERMS_MANAGE_MEMBERS = []Permission{PERM_REMOVE_CIRCLE_MEMBERS, PERM_BAN_CIRCLE_MEMBERS, PERM_MUTE_CIRCLE_MEMBERS}
	PERMS_ALL = []Permission{
		PERM_VIEW_CIRCLE, PERM_CHANGE_CIRCLE_NAME, PERM_CREATE_SUBCIRCLE, PERM_DELETE_SUBCIRCLE, PERM_ALLOW_MD_HEADERS, PERM_ALLOW_MD_LINKS, PERM_ALLOW_MD_LISTS,
		PERM_ALLOW_MD_CODE, PERM_ALLOW_MD_CODE_BLOCK, PERM_ALLOW_MD_BOLD, PERM_ALLOW_MD_ITALIC, PERM_ALLOW_MD_UNDERSCORE, PERM_ALLOW_MD_STRIKE, PERM_ALLOW_MD_SPOILER,
		PERM_SEND_CONTENT, PERM_DELETE_CONTENT, PERM_DELETE_OWN_CONTENT, PERM_EDIT_OWN_CONTENT, PERM_REACT_CONTENT_NEW, PERM_REACT_CONTENT_ADD, PERM_SEND_ATTACHMENTS,
		PERM_SEND_EMBEDS, PERM_EDIT_DEFAULT_SUBCIRCLE_COM_TYPE, PERM_EDIT_DEFAULT_SUBCIRCLE_PERMISSIONS, PERM_ADD_ROLE, PERM_DELETE_ROLE, PERM_EDIT_ROLE_PERMISSIONS,
		PERM_EDIT_ROLE_NAME, PERM_EDIT_ROLE_COLOR, PERM_EDIT_ROLE_MEMBERS, PERM_INVITE_CIRCLE_MEMBERS, PERM_REMOVE_CIRCLE_MEMBERS, PERM_BAN_CIRCLE_MEMBERS, PERM_MUTE_CIRCLE_MEMBERS,
        PERM_MENTION_EVERYONE,
	}

	PERMS_NAME_MAP = func()map[string]Permission {
		rtv := make(map[string]Permission, len(PERMS_ALL))
		for _, p := range PERMS_ALL {
			rtv[p.Name] = p
		}
		return rtv
	}()

	DEFAULT_ROLE_COLOR = [3]byte{0x7f, 0x7f, 0x7f}
)

type CircleInfo struct {
	Id       CircleId
	ParentId *CircleId
	OwnerId  AccountId
	Name     string
	Created  time.Time
	ComType  CommunicationType

    DefaultSubcircleComType CommunicationType
    DefaultSubcirclePermissions PermissionsList
}

func (c *CircleInfo)GetParent() (*CircleInfo, error) {
	if (c.ParentId != nil) {
		return GetCircleInfo(*c.ParentId)
	}
	return nil, nil
}

type RoleInfo struct {
	Id RoleId
	CircleId CircleId
	Order int
	Name string
	Color [3]uint8
}

func PermissionsFromBytes(data []byte) PermissionsList {
    length := binary.BigEndian.Uint64(data)
    if length == 0 {
        return nil
    }
    list := make(PermissionsList, length)

    grantBits := (length + (8 - 1)) / 8
    grantBitsIndex := 0
    cursor := 8 + grantBits

    for i := uint64(0); i < length; i++ {
        permissionNumber := int64(binary.BigEndian.Uint64(data[cursor:]))
        cursor += 8
        list[permissionNumber] = uint8(data[8 + grantBitsIndex / 8]) & uint8(1 << (grantBitsIndex % 8)) != 0
        grantBitsIndex++
    }

    return list
}

func PermissionsToBytes(list PermissionsList) []byte {
    length := len(list)
    if length == 0 {
        return []byte{0,0,0,0,0,0,0,0}
    }
    grantBits := (length + (8 - 1)) / 8

    b := make([]byte, 8 + grantBits + length * 8)
    binary.BigEndian.PutUint64(b, uint64(length))
    grantByte := uint8(0)
    grantBitsIndex := 0
    cursor := 8 + grantBits

    for permissionNumber, granted := range list {
        binary.BigEndian.PutUint64(b[cursor:], uint64(permissionNumber))
        if granted {
            grantByte &= uint8(1 << (grantBitsIndex % 8))
        }
        if grantBitsIndex % 8 == 7 { // == 7 because index is pointing to the end of this byte
            b[8 + grantBitsIndex / 8] = grantByte
        }
        cursor += 8
        grantBitsIndex++
    }
    if length % 8 != 0 { //if byte wasn't already added
        b[8 + grantBitsIndex / 8 - 1] = grantByte // - 1 because index is pointing at a non-existent next byte
    }

    return b
}

func GetCircleInfo(id CircleId) (*CircleInfo, error)  {
	info := &CircleInfo{Id: id}
	var rawDefaultSubcirclePermissions []byte
	row := MainDB.QueryRow(`SELECT parent_id, owner_id, name, created, com_type, default_subcircle_com_type, default_subcircle_permissions FROM circles WHERE id=?`, id)
	if err := row.Scan(&info.ParentId, &info.OwnerId, &info.Name, &info.Created, &info.ComType, &info.DefaultSubcircleComType, &rawDefaultSubcirclePermissions); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	info.DefaultSubcirclePermissions = PermissionsFromBytes(rawDefaultSubcirclePermissions)
	return info, nil
}

func idSetString(ids []int64) string {
	roleIdStrings := make([]string, len(ids))
	idSetSize := 2
	for i, roleId := range ids {
		roleIdString := strconv.FormatInt(int64(roleId), 10)
		idSetSize += len(roleIdString)
		roleIdStrings[i] = roleIdString
	}
	lenMin1 := len(roleIdStrings) - 1
	if lenMin1 < 0 {
		return ""
	} else if lenMin1 > 1 {
		idSetSize += 2 * lenMin1
	}

	b := strings.Builder{}
	b.Grow(idSetSize)
	b.WriteByte('(')
	for i := 0; i < lenMin1; i++ {
		b.WriteString(roleIdStrings[i])
		b.WriteString(", ")
	}
	b.WriteString(roleIdStrings[lenMin1])
	b.WriteByte(')')
	return b.String()
}

func GetRoleOrder(roles []RoleId) ([]RoleId, string, error) {
	roleIdSet := idSetString(roles)

	queryString := strings.Join([]string{"SELECT id FROM roles r WHERE id IN ", " ORDER BY r.priority_order ASC"}, roleIdSet)
	rows, err := MainDB.Query(queryString)
	if err != nil {
		return nil, roleIdSet, err
	}
	defer rows.Close()

	orderedList := make([]RoleId, 0, len(roles))
	var roleId RoleId
	for rows.Next() {
		if err := rows.Scan(&roleId); err != nil {
			return nil, roleIdSet, err
		}
		orderedList = append(orderedList, roleId)
	}
	return orderedList, roleIdSet, nil
}

func GetSomePermissions(id CircleId, roles []RoleId, permissions []PermissionNumber) (PermissionsList, error) {
	roleIdSet := idSetString(roles)
	permissionIdSet := idSetString(permissions)
	parents, err := GetAllCircleParents(id)
	if err != nil {
		return nil, err
	}

	const (
		queryStart string = "SELECT role_permissions.permission_number, role_permissions.granted FROM role_permissions INNER JOIN roles ON role_permissions.role_id=roles.id WHERE role_permissions.circle_id=? AND role_permissions.role_id IN "
		permissionsSetPart string = " AND role_permissions.permission_number IN "
		queryEnd string = " ORDER BY roles.priority_order ASC"
	)
	queryStringSize := len(queryStart) + len(permissionsSetPart) + len(queryEnd) + len(roleIdSet) + len(permissionIdSet)
	b := strings.Builder{}
	b.Grow(queryStringSize)
	b.WriteString(queryStart)
	b.WriteString(roleIdSet)
	b.WriteString(permissionsSetPart)
	b.WriteString(permissionIdSet)
	b.WriteString(queryEnd)
	queryString := b.String()

	rows, err := MainDB.Query(queryString, id)
	if err == sql.ErrNoRows {
		rows = nil
	} else if err != nil {
		return nil, err
	}
	permList := make(PermissionsList)

	for i := 0; i <= len(parents); i++ {
		if rows != nil {
			var (
				permissionNumber PermissionNumber
				granted bool
			)
			for rows.Next() {
				if err := rows.Scan(&permissionNumber, &granted); err != nil {
					defer rows.Close()
					return nil, err
				} else if _, ok := permList[permissionNumber]; !ok {
					permList[permissionNumber] = granted
				}
			}
			rows.Close()
		}
		if i < len(parents) {
			rows, err = MainDB.Query(queryString, parents[i])
			if err == sql.ErrNoRows {
				rows = nil
			} else if err != nil {
				return nil, err
			}
		}
	}

	return permList, nil
}

func GetAllPermissions(id CircleId, roles ...RoleId) (PermissionsList, error) {
	roleIdSet := idSetString(roles)
	if len(roleIdSet) < 1 {
		return nil, nil
	}
	parents, err := GetAllCircleParents(id)
	if err != nil {
		return nil, err
	}

	queryString := strings.Join([]string{
		"SELECT role_permissions.permission_number, role_permissions.granted FROM role_permissions INNER JOIN roles ON role_permissions.role_id=roles.id WHERE role_permissions.circle_id=? AND role_permissions.role_id IN ",
		" ORDER BY roles.priority_order ASC",
	}, roleIdSet)

	rows, err := MainDB.Query(queryString, id)
	if err == sql.ErrNoRows {
		rows = nil
	} else if err != nil {
		return nil, err
	}
	permList := make(PermissionsList)
	
	for i := 0; i <= len(parents); i++ {
		if rows != nil {
			var (
				permissionNumber PermissionNumber
				granted bool
			)
			for rows.Next() {
				if err := rows.Scan(&permissionNumber, &granted); err != nil {
					defer rows.Close()
					return nil, err
				} else if _, ok := permList[permissionNumber]; !ok {
					permList[permissionNumber] = granted
				}
			}
			rows.Close()
		}
		if i < len(parents) {
			rows, err = MainDB.Query(queryString, parents[i])
			if err == sql.ErrNoRows {
				rows = nil
			} else if err != nil {
				return nil, err
			}
		}
	}

	return permList, nil
}

func GetAllCircleParents(id CircleId) ([]CircleId, error) {
	//gets parents in order of nearest to furthest
	rows, err := MainDB.Query(
		`WITH RECURSIVE rec AS (
			SELECT id, parent_id, 0 AS depth FROM circles
			WHERE id=?
			UNION ALL SELECT c.id, c.parent_id, (r.depth+1) FROM circles c JOIN rec r ON c.id = r.parent_id
			) SELECT parent_id, depth FROM rec WHERE parent_id IS NOT NULL ORDER BY depth ASC;`,
		id,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	defer rows.Close()

	ids := make([]CircleId, 0)
	for rows.Next() {
		var (
			parentId CircleId
			depth int64
		)
		if err := rows.Scan(&parentId, &depth); err != nil {
			return nil, err
		}
		ids = append(ids, parentId)
	}
	return ids, nil
}

func GetAccountRoles(account AccountId, circle CircleId) ([]RoleId, error) {
    const queryString string = "SELECT id FROM roles r WHERE EXISTS(SELECT 1 FROM role_members INNER JOIN circle_members ON circle_members.account_id=? AND circle_members.circle_id=? WHERE role_members.role_id=r.id AND role_members.circle_member_id=circle_members.id)"
	parents, err := GetAllCircleParents(circle)
	if err != nil {
		return nil, err
	}

    rows, err := MainDB.Query(queryString, account, circle)
    if err == sql.ErrNoRows {
        rows = nil
    } else if err != nil {
        return nil, err
    }

    roleList := make([]RoleId, 0)

    for i := 0; i <= len(parents); i++ {
		if rows != nil {
			var roleId RoleId
			for rows.Next() {
				if err := rows.Scan(&roleId); err != nil {
					defer rows.Close()
					return nil, err
				}
                roleList = append(roleList, roleId)
			}
			rows.Close()
		}
		if i < len(parents) {
			rows, err = MainDB.Query(queryString, account, circle)
			if err == sql.ErrNoRows {
				rows = nil
			} else if err != nil {
				return nil, err
			}
		}
	}

    return roleList, nil
}

func GetAccountRolesInfo(account AccountId, circle CircleId) ([]RoleInfo, error) {
	const queryString string = "SELECT id, circle_id, priority_order, name, color FROM roles r WHERE EXISTS(SELECT 1 FROM role_members INNER JOIN circle_members ON circle_members.account_id=? AND circle_members.circle_id=? WHERE role_members.role_id=r.id AND role_members.circle_member_id=circle_members.id)"
	parents, err := GetAllCircleParents(circle)
	if err != nil {
		return nil, err
	}

    rows, err := MainDB.Query(queryString, account, circle)
    if err == sql.ErrNoRows {
        rows = nil
    } else if err != nil {
        return nil, err
    }

    roleList := make([]RoleInfo, 0)

    for i := 0; i <= len(parents); i++ {
		if rows != nil {
			
			for rows.Next() {
				var (
					roleInfo RoleInfo
					color []byte
				)
				if err := rows.Scan(&roleInfo.Id, &roleInfo.CircleId, &roleInfo.Order, &roleInfo.Name, &color); err != nil {
					defer rows.Close()
					return nil, err
				}
				if color != nil {
					roleInfo.Color = [3]uint8(color)
				} else {
					roleInfo.Color = DEFAULT_ROLE_COLOR
				}
                roleList = append(roleList, roleInfo)
			}
			rows.Close()
		}
		if i < len(parents) {
			rows, err = MainDB.Query(queryString, account, circle)
			if err == sql.ErrNoRows {
				rows = nil
			} else if err != nil {
				return nil, err
			}
		}
	}

	return roleList, nil
}