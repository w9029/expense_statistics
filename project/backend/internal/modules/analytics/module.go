package analytics

import (
	"net/http"

	"expense-statistics-server/internal/http/middleware"
	"expense-statistics-server/internal/http/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func RegisterRoutes(group *gin.RouterGroup, service *Service) {
	group.GET("/:accountBookID/analytics/category-share", func(c *gin.Context) {
		userID, accountBookID, ok := resolveRouteUserAndAccountBook(c)
		if !ok {
			return
		}
		var query CategoryShareQuery
		if err := c.ShouldBindQuery(&query); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		assignOptionalQueryString(c, "date_from", &query.DateFrom)
		assignOptionalQueryString(c, "date_to", &query.DateTo)
		result, err := service.GetCategoryShare(c.Request.Context(), userID, accountBookID, query)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.GET("/:accountBookID/analytics/spending-trend", func(c *gin.Context) {
		userID, accountBookID, ok := resolveRouteUserAndAccountBook(c)
		if !ok {
			return
		}
		var query SpendingTrendQuery
		if err := c.ShouldBindQuery(&query); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		assignOptionalQueryString(c, "bucket", &query.Bucket)
		assignOptionalQueryString(c, "date_from", &query.DateFrom)
		assignOptionalQueryString(c, "date_to", &query.DateTo)
		assignOptionalQueryString(c, "category_ids", &query.CategoryIDs)
		result, err := service.GetSpendingTrend(c.Request.Context(), userID, accountBookID, query)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})
}

func resolveRouteUserAndAccountBook(c *gin.Context) (uuid.UUID, uuid.UUID, bool) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "unauthorized", "missing authenticated user")
		return uuid.Nil, uuid.Nil, false
	}
	accountBookID, err := uuid.Parse(c.Param("accountBookID"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", "invalid accountBookID")
		return uuid.Nil, uuid.Nil, false
	}
	return userID, accountBookID, true
}

func renderError(c *gin.Context, err error) {
	appErr, ok := err.(*AppError)
	if !ok {
		response.Error(c, http.StatusInternalServerError, "internal_error", "internal server error")
		return
	}
	response.Error(c, appErr.Status, appErr.Code, appErr.Message)
}

func assignOptionalQueryString(c *gin.Context, key string, target **string) {
	if value, ok := c.GetQuery(key); ok {
		copied := value
		*target = &copied
	}
}
