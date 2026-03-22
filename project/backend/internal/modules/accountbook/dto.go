package accountbook

import (
	"time"

	"expense-statistics-server/internal/modules/authorization"
	"github.com/google/uuid"
)

type CreateAccountBookRequest struct {
	Name         string  `json:"name" binding:"required,min=1,max=100"`
	BaseCurrency string  `json:"base_currency" binding:"required,len=3"`
	Description  *string `json:"description"`
}

type AccountBookSummaryResponse struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	BaseCurrency string    `json:"base_currency"`
	Description  *string   `json:"description"`
	MyRole       string    `json:"my_role"`
	IsDefault    bool      `json:"is_default"`
	CreatedAt    time.Time `json:"created_at"`
}

type AccountBookDetailResponse struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	OwnerUserID  uuid.UUID `json:"owner_user_id"`
	BaseCurrency string    `json:"base_currency"`
	Description  *string   `json:"description"`
	IsActive     bool      `json:"is_active"`
	MyRole       string    `json:"my_role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type AccountBookAccessResponse struct {
	AccountBookID  uuid.UUID `json:"account_book_id"`
	AccountRole    string    `json:"account_role"`
	AllowedActions []string  `json:"allowed_actions"`
}

type AccountBookRecord struct {
	ID                   uuid.UUID
	Name                 string
	OwnerUserID          uuid.UUID
	BaseCurrency         string
	Description          *string
	IsActive             bool
	CreatedAt            time.Time
	UpdatedAt            time.Time
	DefaultAccountBookID *uuid.UUID
	MyRole               string
}

func toSummaryResponse(record AccountBookRecord) AccountBookSummaryResponse {
	isDefault := record.DefaultAccountBookID != nil && *record.DefaultAccountBookID == record.ID
	return AccountBookSummaryResponse{ID: record.ID, Name: record.Name, BaseCurrency: record.BaseCurrency, Description: record.Description, MyRole: record.MyRole, IsDefault: isDefault, CreatedAt: record.CreatedAt}
}

func toDetailResponse(record AccountBookRecord) *AccountBookDetailResponse {
	return &AccountBookDetailResponse{ID: record.ID, Name: record.Name, OwnerUserID: record.OwnerUserID, BaseCurrency: record.BaseCurrency, Description: record.Description, IsActive: record.IsActive, MyRole: record.MyRole, CreatedAt: record.CreatedAt, UpdatedAt: record.UpdatedAt}
}

func fromAuthorizationAccess(access *authorization.AccountBookAccessResponse) *AccountBookAccessResponse {
	return &AccountBookAccessResponse{AccountBookID: access.AccountBookID, AccountRole: access.AccountRole, AllowedActions: access.AllowedActions}
}
