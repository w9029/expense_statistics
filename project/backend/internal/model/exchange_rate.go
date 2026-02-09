package model

import (
    "time"

    "github.com/google/uuid"
)

type ExchangeRate struct {
    ID 				uuid.UUID 	`gorm:"primaryKey;default:gen_random_uuid()" json:"id"`
    BaseCurrency   	string  	`json:"base_currency"`
    TargetCurrency 	string  	`json:"target_currency"`
    Rate           	float64 	`json:"rate"`
    Date      		time.Time 	`gorm:"default:now()" json:"date"`

    CreatedAt 		time.Time 	`gorm:"default:now()" json:"created_at"`
}
