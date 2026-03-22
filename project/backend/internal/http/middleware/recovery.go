package middleware

import (
	"log/slog"
	"net/http"

	"expense-statistics-server/internal/http/response"

	"github.com/gin-gonic/gin"
)

func Recovery(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if rec := recover(); rec != nil {
				logger.Error("panic recovered", "panic", rec, "request_id", c.Writer.Header().Get("X-Request-ID"))
				response.Error(c, http.StatusInternalServerError, "internal_error", "internal server error")
				c.Abort()
			}
		}()

		c.Next()
	}
}
