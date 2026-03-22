package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Success(c *gin.Context, status int, data any) {
	c.JSON(status, gin.H{
		"ok":         true,
		"data":       data,
		"request_id": c.Writer.Header().Get("X-Request-ID"),
	})
}

func OK(c *gin.Context, data any) {
	Success(c, http.StatusOK, data)
}

func Error(c *gin.Context, status int, code string, message string) {
	c.JSON(status, gin.H{
		"ok":         false,
		"error":      code,
		"message":    message,
		"request_id": c.Writer.Header().Get("X-Request-ID"),
	})
}
