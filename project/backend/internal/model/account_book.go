package model

import (
    "time"

    "github.com/google/uuid"
)

type AccountBook struct {
    ID           uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
    Name         string     `json:"name"`
    OwnerUserID  uuid.UUID  `json:"owner_user_id"`
    BaseCurrency string     `json:"base_currency"`
    Description  string     `json:"description"`
    IsActive     bool       `gorm:"default:true" json:"is_active"`
    CreatedAt    time.Time  `gorm:"default:now()" json:"created_at"`
    UpdatedAt    time.Time  `gorm:"default:now()" json:"updated_at"`
    DeletedAt    *time.Time `json:"deleted_at,omitempty"`
}