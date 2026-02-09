package model

import (
    "time"

    "github.com/google/uuid"
)

type AccountInvitation struct {
    ID             uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
    AccountBookID  uuid.UUID `json:"account_book_id"`
    InviterUserID  uuid.UUID `json:"inviter_user_id"`
    AccountRole    string    `gorm:"default:editor" json:"account_role"`
    Token          string    `json:"token"`
    ExpiresAt      time.Time `json:"expires_at"`
    MaxUsage       int16     `json:"max_usage"`
    UsedCount      int16     `json:"used_count"`
    Status         string    `gorm:"default:pending" json:"status"`
    CreatedAt      time.Time `gorm:"default:now()" json:"created_at"`
}
