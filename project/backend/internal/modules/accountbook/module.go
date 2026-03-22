package accountbook

import (
	"net/http"

	"expense-statistics-server/internal/http/middleware"
	"expense-statistics-server/internal/http/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func RegisterRoutes(group *gin.RouterGroup, service *Service) {
	group.POST("", func(c *gin.Context) {
		userID, ok := middleware.CurrentUserID(c)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing authenticated user")
			return
		}
		var req CreateAccountBookRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.Create(c.Request.Context(), userID, req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.Success(c, http.StatusCreated, result)
	})

	group.GET("", func(c *gin.Context) {
		userID, ok := middleware.CurrentUserID(c)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing authenticated user")
			return
		}
		result, err := service.List(c.Request.Context(), userID)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.GET("/:accountBookID", func(c *gin.Context) {
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
		result, err := service.GetByID(c.Request.Context(), userID, accountBookID)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.GET("/:accountBookID/access", func(c *gin.Context) {
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
		result, err := service.GetAccess(c.Request.Context(), userID, accountBookID)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.GET("/:accountBookID/invitations", func(c *gin.Context) {
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
		result, err := service.ListInvitations(c.Request.Context(), userID, accountBookID)
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
