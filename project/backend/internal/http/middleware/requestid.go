package middleware

import (
	"net/http"
	"strings"

	"expense-statistics-server/internal/http/response"
	jwtplatform "expense-statistics-server/internal/platform/jwt"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	RequestIDKey    = "request_id"
	AuthUserIDKey   = "auth_user_id"
	AuthUserRoleKey = "auth_user_role"
)

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.NewString()
		}
		c.Set(RequestIDKey, requestID)
		c.Writer.Header().Set("X-Request-ID", requestID)
		c.Next()
	}
}

// Authenticate 是一个Gin中间件，用于验证请求中的Bearer Token，并将用户ID和角色存储在上下文中供后续处理使用。
func Authenticate(jwtService *jwtplatform.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			response.Error(c, http.StatusUnauthorized, "missing_token", "missing bearer token")
			c.Abort()
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		claims, err := jwtService.ParseAccessToken(token)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "invalid_token", err.Error())
			c.Abort()
			return
		}

		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "invalid_token", "invalid user id in token")
			c.Abort()
			return
		}

		// 将用户ID和role存储在上下文中，供后续处理使用
		c.Set(AuthUserIDKey, userID)
		c.Set(AuthUserRoleKey, claims.UserRole)
		c.Next()
	}
}

func CurrentUserID(c *gin.Context) (uuid.UUID, bool) {
	value, ok := c.Get(AuthUserIDKey)
	if !ok {
		return uuid.Nil, false
	}
	userID, ok := value.(uuid.UUID)
	return userID, ok
}

func CurrentUserRole(c *gin.Context) (string, bool) {
	value, ok := c.Get(AuthUserRoleKey)
	if !ok {
		return "", false
	}
	role, ok := value.(string)
	return role, ok
}
