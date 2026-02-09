package model

import (
    "time"

    "github.com/google/uuid"
)

type Notification struct {
    ID 			uuid.UUID 	`gorm:"primaryKey;default:gen_random_uuid()" json:"id"`
    UserID 		uuid.UUID 	`json:"user_id"`
    Type  		string  	`json:"type"`
    Title 		string  	`json:"title"`
    Message 	*string 	`json:"message"`
    Status 		string 		`gorm:"default:unread" json:"status"`

    CreatedAt 	time.Time 	`gorm:"default:now()" json:"created_at"`
}
