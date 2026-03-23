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

	group.PUT("/:accountBookID", func(c *gin.Context) {
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
		var req UpdateAccountBookRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.Update(c.Request.Context(), userID, accountBookID, req)
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

	group.GET("/:accountBookID/members", func(c *gin.Context) {
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
		result, err := service.ListMembers(c.Request.Context(), userID, accountBookID)
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

	group.DELETE("/:accountBookID/invitations/:invitationID", func(c *gin.Context) {
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
		invitationID, err := uuid.Parse(c.Param("invitationID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid invitationID")
			return
		}
		result, err := service.DeleteInvitation(c.Request.Context(), userID, accountBookID, invitationID)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.POST("/:accountBookID/owner-transfer", func(c *gin.Context) {
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
		var req TransferOwnerRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.TransferOwner(c.Request.Context(), userID, accountBookID, req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.DELETE("/:accountBookID/members/:userID", func(c *gin.Context) {
		currentUserID, ok := middleware.CurrentUserID(c)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing authenticated user")
			return
		}
		accountBookID, err := uuid.Parse(c.Param("accountBookID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid accountBookID")
			return
		}
		targetUserID, err := uuid.Parse(c.Param("userID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid userID")
			return
		}
		result, err := service.RemoveMember(c.Request.Context(), currentUserID, accountBookID, targetUserID)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.POST("/:accountBookID/leave", func(c *gin.Context) {
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
		result, err := service.Leave(c.Request.Context(), userID, accountBookID)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.DELETE("/:accountBookID", func(c *gin.Context) {
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
		result, err := service.Delete(c.Request.Context(), userID, accountBookID)
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
