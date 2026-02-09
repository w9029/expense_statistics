package model

import (
    "time"

    "github.com/google/uuid"
)

type ExpenseCategory struct {
    ID              uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
    AccountBookID   *uuid.UUID `json:"account_book_id"`
    Name            string     `json:"name"`
    Description     *string    `json:"description"`
    IsMergeCategory bool       `gorm:"default:false" json:"is_merge_category"`
    CreatedAt       time.Time  `gorm:"default:now()" json:"created_at"`
    UpdatedAt       time.Time  `gorm:"default:now()" json:"updated_at"`
    DeletedAt       *time.Time `json:"deleted_at,omitempty"`
}