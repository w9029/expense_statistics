package model

import (
    "time"

    "github.com/google/uuid"
)

type AccountbookUserPermission struct {
    ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
    AccountBookID uuid.UUID `json:"account_book_id"`
    UserID        uuid.UUID `json:"user_id"`
    AccountRole   string    `gorm:"default:editor" json:"account_role"`
    CreatedAt     time.Time `gorm:"default:now()" json:"created_at"`
}