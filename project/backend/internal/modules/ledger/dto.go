package ledger

import (
	"regexp"
	"time"

	"github.com/google/uuid"
)

var colorPattern = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)

type CreateExpenseCategoryRequest struct {
	Name            string  `json:"name" binding:"required,min=1,max=100"`
	Description     *string `json:"description"`
	IsMergeCategory bool    `json:"is_merge_category"`
	Color           string  `json:"color" binding:"required,len=7"`
}

type UpdateExpenseCategoryRequest struct {
	Name            string  `json:"name" binding:"required,min=1,max=100"`
	Description     *string `json:"description"`
	IsMergeCategory bool    `json:"is_merge_category"`
	Color           string  `json:"color" binding:"required,len=7"`
}

type ExpenseCategoryResponse struct {
	ID              uuid.UUID `json:"id"`
	AccountBookID   uuid.UUID `json:"account_book_id"`
	Name            string    `json:"name"`
	Description     *string   `json:"description"`
	IsMergeCategory bool      `json:"is_merge_category"`
	Color           string    `json:"color"`
	IsSystemSeed    bool      `json:"is_system_seed"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type CreateNormalExpenseRequest struct {
	CategoryID       uuid.UUID `json:"category_id" binding:"required"`
	Name             string    `json:"name" binding:"required,min=1,max=200"`
	Description      *string   `json:"description"`
	OriginalAmount   string    `json:"original_amount" binding:"required"`
	OriginalCurrency string    `json:"original_currency" binding:"required,len=3"`
	SpentAt          string    `json:"spent_at" binding:"required,len=10"`
}

type UpdateNormalExpenseRequest struct {
	CategoryID       uuid.UUID `json:"category_id" binding:"required"`
	Name             string    `json:"name" binding:"required,min=1,max=200"`
	Description      *string   `json:"description"`
	OriginalAmount   string    `json:"original_amount" binding:"required"`
	OriginalCurrency string    `json:"original_currency" binding:"required,len=3"`
	SpentAt          string    `json:"spent_at" binding:"required,len=10"`
}

type CreateMergedExpenseRequest struct {
	Parent                  MergedExpenseParentInput  `json:"parent" binding:"required"`
	ChildrenAmountInputMode string                    `json:"children_amount_input_mode" binding:"required"`
	Children                []MergedExpenseChildInput `json:"children" binding:"required,min=1,dive"`
}

type UpdateMergedExpenseRequest struct {
	Parent                  MergedExpenseParentInput  `json:"parent" binding:"required"`
	ChildrenAmountInputMode string                    `json:"children_amount_input_mode" binding:"required"`
	Children                []MergedExpenseChildInput `json:"children" binding:"required,min=1,dive"`
}

type MergedExpenseParentInput struct {
	CategoryID          uuid.UUID `json:"category_id" binding:"required"`
	Name                string    `json:"name" binding:"required,min=1,max=200"`
	Description         *string   `json:"description"`
	TotalOriginalAmount string    `json:"total_original_amount" binding:"required"`
	OriginalCurrency    string    `json:"original_currency" binding:"required,len=3"`
	SpentAt             string    `json:"spent_at" binding:"required,len=10"`
}

type MergedExpenseChildInput struct {
	CategoryID  uuid.UUID `json:"category_id" binding:"required"`
	Name        string    `json:"name" binding:"required,min=1,max=200"`
	Description *string   `json:"description"`
	AmountInput string    `json:"amount_input" binding:"required"`
}

type ListExpensesQuery struct {
	DateFrom         *string `form:"date_from"`
	DateTo           *string `form:"date_to"`
	CategoryID       *string `form:"category_id"`
	CategoryIDs      *string `form:"category_ids"`
	UserID           *string `form:"user_id"`
	MinAmount        *string `form:"min_amount"`
	MaxAmount        *string `form:"max_amount"`
	OriginalCurrency *string `form:"original_currency"`
	Keyword          *string `form:"keyword"`
	SpentAtOrder     *string `form:"spent_at_order"`
	IncludeChildren  bool    `form:"include_children"`
	Page             int     `form:"page"`
	PageSize         int     `form:"page_size"`
}

type ExpenseResponse struct {
	ID               uuid.UUID  `json:"id"`
	AccountBookID    uuid.UUID  `json:"account_book_id"`
	UserID           *uuid.UUID `json:"user_id"`
	CategoryID       uuid.UUID  `json:"category_id"`
	ExpenseType      string     `json:"expense_type"`
	ParentID         *uuid.UUID `json:"parent_id,omitempty"`
	Name             string     `json:"name"`
	Description      *string    `json:"description"`
	OriginalAmount   string     `json:"original_amount"`
	OriginalCurrency string     `json:"original_currency"`
	ExchangeRateUsed string     `json:"exchange_rate_used"`
	ConvertedAmount  string     `json:"converted_amount"`
	SpentAt          string     `json:"spent_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type ExpenseSummaryResponse struct {
	ExpenseResponse
	ChildrenCount int64             `json:"children_count"`
	Expandable    bool              `json:"expandable"`
	Children      []ExpenseResponse `json:"children,omitempty"`
}

type ExpenseListResponse struct {
	Items    []ExpenseSummaryResponse `json:"items"`
	Page     int                      `json:"page"`
	PageSize int                      `json:"page_size"`
	Total    int64                    `json:"total"`
}

type ExpenseDetailResponse struct {
	Expense  ExpenseResponse   `json:"expense"`
	Children []ExpenseResponse `json:"children,omitempty"`
	IsRoot   bool              `json:"is_root"`
	RootID   uuid.UUID         `json:"root_id"`
}

type CreateMergedExpenseResponse struct {
	Parent                  ExpenseResponse   `json:"parent"`
	Children                []ExpenseResponse `json:"children"`
	ChildrenAmountInputMode string            `json:"children_amount_input_mode"`
}

type DeleteExpenseResponse struct {
	ExpenseID uuid.UUID `json:"expense_id"`
	RootID    uuid.UUID `json:"root_id"`
	Deleted   bool      `json:"deleted"`
}

func toExpenseCategoryResponse(record ExpenseCategoryRecord) ExpenseCategoryResponse {
	return ExpenseCategoryResponse{
		ID:              record.ID,
		AccountBookID:   record.AccountBookID,
		Name:            record.Name,
		Description:     record.Description,
		IsMergeCategory: record.IsMergeCategory,
		Color:           record.Color,
		IsSystemSeed:    record.IsSystemSeed,
		CreatedAt:       record.CreatedAt,
		UpdatedAt:       record.UpdatedAt,
	}
}

func toExpenseResponse(record ExpenseRecord) ExpenseResponse {
	return ExpenseResponse{
		ID:               record.ID,
		AccountBookID:    record.AccountBookID,
		UserID:           record.UserID,
		CategoryID:       record.CategoryID,
		ExpenseType:      record.ExpenseType,
		ParentID:         record.ParentID,
		Name:             record.Name,
		Description:      record.Description,
		OriginalAmount:   record.OriginalAmount,
		OriginalCurrency: record.OriginalCurrency,
		ExchangeRateUsed: record.ExchangeRateUsed,
		ConvertedAmount:  record.ConvertedAmount,
		SpentAt:          record.SpentAt.Format("2006-01-02"),
		CreatedAt:        record.CreatedAt,
		UpdatedAt:        record.UpdatedAt,
	}
}

func toExpenseSummaryResponse(record ExpenseRecord) ExpenseSummaryResponse {
	return ExpenseSummaryResponse{
		ExpenseResponse: toExpenseResponse(record),
		ChildrenCount:   record.ChildrenCount,
		Expandable:      record.ExpenseType == "merged_parent" && record.ChildrenCount > 0,
	}
}
