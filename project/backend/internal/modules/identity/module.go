package identity

import (
	"log/slog"
	"net/http"

	"expense-statistics-server/internal/http/middleware"
	"expense-statistics-server/internal/http/response"
	"expense-statistics-server/internal/platform/clock"
	"expense-statistics-server/internal/platform/db"
	"expense-statistics-server/internal/platform/jwt"
	"expense-statistics-server/internal/platform/mail"

	"github.com/gin-gonic/gin"
)

// Deps 定义 identity 模块初始化时需要注入的依赖。
type Deps struct {
	DB     *db.Database
	Logger *slog.Logger
	Clock  clock.Clock
	JWT    *jwt.Service
	Mail   mail.Sender
}

// 模块内部真正持有的运行时依赖。
// repo 负责查库，logger 记日志，clock 统一时间来源，jwt生成和解析token
type Service struct {
	repo   *Repository
	logger *slog.Logger
	clock  clock.Clock
	jwt    *jwt.Service
	mail   mail.Sender
}

// 把外部依赖组装成 identity.Service 顺便创建了一个 Repository 实例。
func NewService(deps Deps) *Service {
	return &Service{repo: NewRepository(deps.DB), logger: deps.Logger, clock: deps.Clock, jwt: deps.JWT, mail: deps.Mail}
}

func RegisterRoutes(group *gin.RouterGroup, service *Service) {
	group.GET("/ping", func(c *gin.Context) {
		response.OK(c, gin.H{"module": "identity", "time": service.clock.Now().Format("2006-01-02T15:04:05Z07:00")})
	})
	group.POST("/email-verifications/send", func(c *gin.Context) {
		var req SendVerificationCodeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		if err := service.SendVerificationCode(c.Request.Context(), req); err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, gin.H{"message": "verification code sent"})
	})
	group.POST("/email-verifications/verify", func(c *gin.Context) {
		var req VerifyCodeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.VerifyCode(c.Request.Context(), req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})
	group.POST("/register", func(c *gin.Context) {
		var req RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.Register(c.Request.Context(), req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.Success(c, http.StatusCreated, result)
	})
	group.POST("/login", func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.Login(c.Request.Context(), req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})
	group.POST("/refresh", func(c *gin.Context) {
		var req RefreshRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.Refresh(c.Request.Context(), req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})
}

func RegisterProtectedRoutes(group *gin.RouterGroup, service *Service) {
	group.PUT("/me/profile", func(c *gin.Context) {
		userID, ok := middleware.CurrentUserID(c)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing authenticated user")
			return
		}
		var req UpdateProfileRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.UpdateProfile(c.Request.Context(), userID, req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.PUT("/me/default-account-book", func(c *gin.Context) {
		userID, ok := middleware.CurrentUserID(c)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing authenticated user")
			return
		}
		var req UpdateDefaultAccountBookRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.UpdateDefaultAccountBook(c.Request.Context(), userID, req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})
}

func renderError(c *gin.Context, err error) {
	appErr, ok := err.(*AppError)
	if !ok {
		response.Error(c, http.StatusInternalServerError, "internal_error", "internal server error")
		return
	}
	response.Error(c, appErr.Status, appErr.Code, appErr.Message)
}
