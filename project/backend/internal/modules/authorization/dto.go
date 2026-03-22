package authorization

import "github.com/google/uuid"

type CurrentPrincipalResponse struct {
	UserID   uuid.UUID `json:"user_id"`
	UserRole string    `json:"user_role"`
}

type AccountBookAccessResponse struct {
	AccountBookID  uuid.UUID `json:"account_book_id"`
	AccountRole    string    `json:"account_role"`
	AllowedActions []string  `json:"allowed_actions"`
}
