package router

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"expense-statistics-server/internal/http/middleware"
	"expense-statistics-server/internal/http/response"
	"expense-statistics-server/internal/modules/identity"
	"expense-statistics-server/internal/platform/clock"
	"expense-statistics-server/internal/platform/config"
	"expense-statistics-server/internal/platform/db"

	"github.com/gin-gonic/gin"
)

type Deps struct {
	Config *config.Config
	Logger *slog.Logger
	DB     *db.Database
	Clock  clock.Clock
}

func New(deps Deps) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)

	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger(deps.Logger))
	r.Use(middleware.Recovery(deps.Logger))

	registerSystemRoutes(r, deps)
	registerModuleRoutes(r, deps)

	return r
}

func registerSystemRoutes(r *gin.Engine, deps Deps) {
	r.GET("/healthz", func(c *gin.Context) {
		response.OK(c, gin.H{
			"app": deps.Config.AppName,
			"env": deps.Config.Env,
			"now": deps.Clock.Now().Format(time.RFC3339),
		})
	})

	r.GET("/readyz", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
		defer cancel()

		if err := deps.DB.Ping(ctx); err != nil {
			response.Error(c, http.StatusServiceUnavailable, "database_unavailable", err.Error())
			return
		}

		currentDate, err := deps.DB.CurrentDate(ctx)
		if err != nil {
			response.Error(c, http.StatusServiceUnavailable, "database_query_failed", err.Error())
			return
		}

		response.OK(c, gin.H{
			"database":        "ok",
			"database_date":   currentDate.Format("2006-01-02"),
			"server_time_utc": deps.Clock.Now().UTC().Format(time.RFC3339),
		})
	})
}

func registerModuleRoutes(r *gin.Engine, deps Deps) {
	v1 := r.Group("/api/v1")

	identityService := identity.NewService(deps.Clock)
	identity.RegisterRoutes(v1.Group("/identity"), identityService)
}
