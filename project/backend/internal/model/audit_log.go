package model

import (
    "time"

    "github.com/google/uuid"
    "gorm.io/datatypes"
)

type AuditLog struct {
    ID 			uuid.UUID 		`gorm:"primaryKey;default:gen_random_uuid()" json:"id"`
    UserID 		uuid.UUID 		`json:"user_id"`
    Action 		string    		`json:"action"`
    TargetType 	*string    		`json:"target_type"`
    TargetID   	*uuid.UUID 		`json:"target_id"`
    Detail     	*datatypes.JSON `json:"detail"`
    IPAddress 	string 			`json:"ip_address"`
    UserAgent 	string 			`json:"user_agent"`

    CreatedAt 	time.Time 		`gorm:"default:now()" json:"created_at"`
}
