package exchange

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

func notFound(message string) *AppError {
	return newAppError(http.StatusNotFound, "not_found", message)
}

func rateLimited(message string) *AppError {
	return newAppError(http.StatusTooManyRequests, "rate_limited", message)
}

func serviceUnavailable(message string) *AppError {
	return newAppError(http.StatusServiceUnavailable, "service_unavailable", message)
}

func internalError(message string) *AppError {
	return newAppError(http.StatusInternalServerError, "internal_error", message)
}
