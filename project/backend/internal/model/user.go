package model

import (
    "time"
    "github.com/google/uuid"
)

// type User struct {
//     ID                   uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
//     Email                string     `gorm:"unique;not null" json:"email"`
//     PasswordHash         string     `gorm:"not null" json:"password_hash"`
//     Name                 string     `gorm:"not null" json:"name"`
//     PreferredCurrency    string     `gorm:"type:varchar(3);default:CNY;not null" json:"preferred_currency"`
//     UserRole             string     `gorm:"default:user;not null" json:"user_role"`
//     DefaultAccountBookID *uuid.UUID `gorm:"type:uuid" json:"default_account_book_id"`
//     IsActive             bool       `gorm:"default:true;not null" json:"is_active"`
//     CreatedAt            time.Time  `gorm:"autoCreateTime" json:"created_at"`
//     UpdatedAt            time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
//     DeletedAt            *time.Time `gorm:"index" json:"deleted_at,omitempty"`
// }

type User struct {
    ID                   uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
    Email                string     `json:"email"`
    PasswordHash         string     `json:"password_hash"`
    Name                 string     `json:"name"`
    PreferredCurrency    string     `json:"preferred_currency"`
    UserRole             string     `json:"user_role"`
    DefaultAccountBookID *uuid.UUID `json:"default_account_book_id"`
    IsActive             bool       `json:"is_active"`
    CreatedAt            time.Time  `json:"created_at"`
    UpdatedAt            time.Time  `json:"updated_at"`
    DeletedAt            *time.Time `json:"deleted_at,omitempty"`
}
