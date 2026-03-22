package authorization

import (
	"log/slog"
	"net/http"

	"expense-statistics-server/internal/http/middleware"
	"expense-statistics-server/internal/http/response"
	"expense-statistics-server/internal/platform/db"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Deps struct {
	DB     *db.Database
	Logger *slog.Logger
}

type Service struct {
	repo   *Repository
	logger *slog.Logger
}

func NewService(deps Deps) *Service {
	return &Service{repo: NewRepository(deps.DB), logger: deps.Logger}
}

func RegisterRoutes(group *gin.RouterGroup, service *Service) {
	group.GET("/me", func(c *gin.Context) {
		userID, ok := middleware.CurrentUserID(c)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing authenticated user")
			return
		}
		userRole, _ := middleware.CurrentUserRole(c)
		response.OK(c, service.CurrentPrincipal(userID, userRole))
	})

	group.GET("/account-books/:accountBookID/access", func(c *gin.Context) {
		userID, ok := middleware.CurrentUserID(c)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing authenticated user")
			return
		}
		accountBookID, err := uuid.Parse(c.Param("accountBookID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid accountBookID")
			return
		}
		result, err := service.GetAccountBookAccess(c.Request.Context(), userID, accountBookID)
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
