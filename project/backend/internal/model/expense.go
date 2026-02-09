package model

import (
    "time"

    "github.com/google/uuid"
)

type Expense struct {
    ID               uuid.UUID  `gorm:"default:gen_random_uuid();primaryKey" json:"id"`
    AccountBookID    uuid.UUID  `json:"account_book_id"`
    UserID           uuid.UUID  `json:"user_id"`
    CategoryID       uuid.UUID  `json:"category_id"`
    ParentID         *uuid.UUID `json:"parent_id"`
    Name             string     `json:"name"`
    Description      *string    `json:"description"`
    OriginalAmount   float64    `json:"original_amount"`
    OriginalCurrency string     `json:"original_currency"`
    ExchangeRateUsed float64    `json:"exchange_rate_used"`
    ConvertedAmount  float64    `json:"converted_amount"`

    SpentAt          time.Time  `gorm:"default:now()" json:"spent_at"`
    CreatedAt        time.Time  `gorm:"default:now()" json:"created_at"`
    UpdatedAt        time.Time  `gorm:"default:now()" json:"updated_at"`
    DeletedAt        *time.Time `json:"deleted_at"`
}
