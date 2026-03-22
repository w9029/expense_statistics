package invitation

import (
	"net/http"

	"expense-statistics-server/internal/http/middleware"
	"expense-statistics-server/internal/http/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func RegisterPublicRoutes(group *gin.RouterGroup, service *Service) {
	// 根据token获取invitation详情
	group.GET("/:token", func(c *gin.Context) {
		result, err := service.GetByToken(c.Request.Context(), c.Param("token"))
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})
}

func RegisterProtectedRoutes(group *gin.RouterGroup, service *Service) {

	// 创建invitation
	group.POST("", func(c *gin.Context) {
		userID, ok := middleware.CurrentUserID(c)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing authenticated user")
			return
		}
		var req CreateInvitationRequest
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
	// 接受invitation
	group.POST("/:token/accept", func(c *gin.Context) {
		userID, ok := middleware.CurrentUserID(c)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing authenticated user")
			return
		}
		result, err := service.Accept(c.Request.Context(), c.Param("token"), userID)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.POST("/id/:invitationID/revoke", func(c *gin.Context) {
		userID, ok := middleware.CurrentUserID(c)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing authenticated user")
			return
		}
		invitationID, err := uuid.Parse(c.Param("invitationID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid invitationID")
			return
		}
		result, err := service.Revoke(c.Request.Context(), invitationID, userID)
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
