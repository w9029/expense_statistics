package model

import (
    "time"
    "github.com/google/uuid"
)

// if a field allows null, use pointer type

type User struct {
    ID                   uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
    Email                string     `json:"email"`
    PasswordHash         string     `json:"password_hash"`
    Name                 string     `json:"name"`
    PreferredCurrency    string     `json:"preferred_currency"`
    UserRole             string     `gorm:"default:user;" json:"user_role"`
    DefaultAccountBookID *uuid.UUID `json:"default_account_book_id"`
    IsActive             bool       `gorm:"default:true;" json:"is_active"`
    CreatedAt            time.Time  `gorm:"default:now()" json:"created_at"`
    UpdatedAt            time.Time  `gorm:"default:now()" json:"updated_at"`
    DeletedAt            *time.Time `gorm:"index" json:"deleted_at,omitempty"`
}


