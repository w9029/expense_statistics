package model

import (
    "time"

    "github.com/google/uuid"
)

type Budget struct {
    ID 				uuid.UUID 	`gorm:"primaryKey;default:gen_random_uuid()" json:"id"`
    AccountBookID 	uuid.UUID  	`json:"account_book_id"`
    CategoryID    	*uuid.UUID 	`json:"category_id"`
    CycleType     	string 		`json:"cycle_type"`
    CycleStartDay 	int    		`gorm:"default:1" json:"cycle_start_day"`
    Amount   		float64 	`json:"amount"`
    Currency 		string  	`json:"currency"`
    IsActive 		bool 		`gorm:"default:true" json:"is_active"`
    StartDate 		time.Time 	`json:"start_date"`
    EndDate   		time.Time 	`json:"end_date"`
	
    CreatedAt 		time.Time 	`gorm:"default:now()" json:"created_at"`
    UpdatedAt 		time.Time 	`gorm:"default:now()" json:"updated_at"`
}
