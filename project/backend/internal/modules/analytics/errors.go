package analytics

import "net/http"

type AppError struct {
	Status  int
	Code    string
	Message string
}

func (e *AppError) Error() string { return e.Message }

func newAppError(status int, code string, message string) *AppError {
	return &AppError{Status: status, Code: code, Message: message}
}

func invalidRequest(message string) *AppError {
	return newAppError(http.StatusBadRequest, "invalid_request", message)
}

func forbidden(message string) *AppError {
	return newAppError(http.StatusForbidden, "forbidden", message)
}

func internalError(message string) *AppError {
	return newAppError(http.StatusInternalServerError, "internal_error", message)
}
