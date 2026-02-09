package model

import (
    "time"

    "github.com/google/uuid"
)

type AuthRefreshToken struct {
    ID 				uuid.UUID 	`gorm:"primaryKey;default:gen_random_uuid()" json:"id"`
    UserID       	uuid.UUID 	`json:"user_id"`
    RefreshToken 	string    	`json:"refresh_token"`
    ExpiresAt 		time.Time 	`json:"expires_at"`
    RevokedAt 		*time.Time 	`json:"revoked_at"`

    CreatedAt 		time.Time 	`gorm:"default:now()" json:"created_at"`
}
