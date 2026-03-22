package authorization

import (
	"log/slog"
	"net/http"

	"expense-statistics-server/internal/http/middleware"
	"expense-statistics-server/internal/http/response"
	"expense-statistics-server/internal/platform/db"

	"github.com/gin-gonic/gin"
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
}
