package ledger

import (
	"time"

	"github.com/google/uuid"
)

type ExpenseCategoryRecord struct {
	ID              uuid.UUID
	AccountBookID   uuid.UUID
	Name            string
	Description     *string
	IsMergeCategory bool
	Color           string
	IsSystemSeed    bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type ExpenseRecord struct {
	ID                             uuid.UUID
	AccountBookID                  uuid.UUID
	UserID                         *uuid.UUID
	CategoryID                     uuid.UUID
	ExpenseType                    string
	ParentID                       *uuid.UUID
	Name                           string
	Description                    *string
	OriginalAmount                 string
	OriginalCurrency               string
	ExchangeRateUsed               string
	ConvertedAmount                string
	SpentAt                        time.Time
	CreatedAt                      time.Time
	UpdatedAt                      time.Time
	ChildrenCount                  int64
	MatchedChildrenCount           int64
	MatchedChildrenConvertedAmount string
}
