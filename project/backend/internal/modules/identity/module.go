package identity

import (
	"expense-statistics-server/internal/http/response"
	"expense-statistics-server/internal/platform/clock"

	"github.com/gin-gonic/gin"
)

type Service struct {
	clock clock.Clock
}

func NewService(clock clock.Clock) *Service {
	return &Service{clock: clock}
}

func RegisterRoutes(group *gin.RouterGroup, service *Service) {
	group.GET("/ping", func(c *gin.Context) {
		response.OK(c, gin.H{
			"module": "identity",
			"time":   service.clock.Now().Format("2006-01-02T15:04:05Z07:00"),
		})
	})
}
