package authorization

import (
	"net/http"

	"github.com/google/uuid"
)

type CurrentPrincipalResponse struct {
	UserID   uuid.UUID `json:"user_id"`
	UserRole string    `json:"user_role"`
}

type AccountBookAccessResponse struct {
	AccountBookID  uuid.UUID `json:"account_book_id"`
	AccountRole    string    `json:"account_role"`
	AllowedActions []string  `json:"allowed_actions"`
}

type AccountBookPermissionRecord struct {
	AccountBookID uuid.UUID
	UserID        uuid.UUID
	AccountRole   string
}

type AppError struct {
	Status  int
	Code    string
	Message string
}

func (e *AppError) Error() string { return e.Message }
func newAppError(status int, code string, message string) *AppError {
	return &AppError{Status: status, Code: code, Message: message}
}
func forbidden(message string) *AppError {
	return newAppError(http.StatusForbidden, "forbidden", message)
}
func internalError(message string) *AppError {
	return newAppError(http.StatusInternalServerError, "internal_error", message)
}
