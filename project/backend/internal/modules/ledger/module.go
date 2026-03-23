package ledger

import (
	"net/http"

	"expense-statistics-server/internal/http/middleware"
	"expense-statistics-server/internal/http/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func RegisterRoutes(group *gin.RouterGroup, service *Service) {
	group.GET("/:accountBookID/expense-categories", func(c *gin.Context) {
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
		result, err := service.ListCategories(c.Request.Context(), userID, accountBookID)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.GET("/:accountBookID/expense-categories/:categoryID", func(c *gin.Context) {
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
		categoryID, err := uuid.Parse(c.Param("categoryID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid categoryID")
			return
		}
		result, err := service.GetCategory(c.Request.Context(), userID, accountBookID, categoryID)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.POST("/:accountBookID/expense-categories", func(c *gin.Context) {
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
		var req CreateExpenseCategoryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.CreateCategory(c.Request.Context(), userID, accountBookID, req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.Success(c, http.StatusCreated, result)
	})

	group.PUT("/:accountBookID/expense-categories/:categoryID", func(c *gin.Context) {
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
		categoryID, err := uuid.Parse(c.Param("categoryID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid categoryID")
			return
		}
		var req UpdateExpenseCategoryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.UpdateCategory(c.Request.Context(), userID, accountBookID, categoryID, req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.DELETE("/:accountBookID/expense-categories/:categoryID", func(c *gin.Context) {
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
		categoryID, err := uuid.Parse(c.Param("categoryID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid categoryID")
			return
		}
		if err := service.DeleteCategory(c.Request.Context(), userID, accountBookID, categoryID); err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, gin.H{"deleted": true, "category_id": categoryID})
	})

	group.GET("/:accountBookID/expenses", func(c *gin.Context) {
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
		var query ListExpensesQuery
		if err := c.ShouldBindQuery(&query); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		assignOptionalExpenseListQueryStrings(c, &query)
		result, err := service.ListExpenses(c.Request.Context(), userID, accountBookID, query)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.GET("/:accountBookID/expenses/:expenseID", func(c *gin.Context) {
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
		expenseID, err := uuid.Parse(c.Param("expenseID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid expenseID")
			return
		}
		result, err := service.GetExpenseDetail(c.Request.Context(), userID, accountBookID, expenseID)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.PUT("/:accountBookID/expenses/:expenseID/normal", func(c *gin.Context) {
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
		expenseID, err := uuid.Parse(c.Param("expenseID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid expenseID")
			return
		}
		var req UpdateNormalExpenseRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.UpdateNormalExpense(c.Request.Context(), userID, accountBookID, expenseID, req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.PUT("/:accountBookID/expenses/:expenseID/merged", func(c *gin.Context) {
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
		expenseID, err := uuid.Parse(c.Param("expenseID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid expenseID")
			return
		}
		var req UpdateMergedExpenseRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.UpdateMergedExpense(c.Request.Context(), userID, accountBookID, expenseID, req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.DELETE("/:accountBookID/expenses/:expenseID", func(c *gin.Context) {
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
		expenseID, err := uuid.Parse(c.Param("expenseID"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "invalid expenseID")
			return
		}
		result, err := service.DeleteExpense(c.Request.Context(), userID, accountBookID, expenseID)
		if err != nil {
			renderError(c, err)
			return
		}
		response.OK(c, result)
	})

	group.POST("/:accountBookID/expenses/normal", func(c *gin.Context) {
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
		var req CreateNormalExpenseRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.CreateNormalExpense(c.Request.Context(), userID, accountBookID, req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.Success(c, http.StatusCreated, result)
	})

	group.POST("/:accountBookID/expenses/merged", func(c *gin.Context) {
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
		var req CreateMergedExpenseRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		result, err := service.CreateMergedExpense(c.Request.Context(), userID, accountBookID, req)
		if err != nil {
			renderError(c, err)
			return
		}
		response.Success(c, http.StatusCreated, result)
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

func assignOptionalExpenseListQueryStrings(c *gin.Context, query *ListExpensesQuery) {
	assignOptionalQueryString(c, "date_from", &query.DateFrom)
	assignOptionalQueryString(c, "date_to", &query.DateTo)
	assignOptionalQueryString(c, "category_id", &query.CategoryID)
	assignOptionalQueryString(c, "category_ids", &query.CategoryIDs)
	assignOptionalQueryString(c, "user_id", &query.UserID)
	assignOptionalQueryString(c, "min_amount", &query.MinAmount)
	assignOptionalQueryString(c, "max_amount", &query.MaxAmount)
	assignOptionalQueryString(c, "original_currency", &query.OriginalCurrency)
	assignOptionalQueryString(c, "keyword", &query.Keyword)
	assignOptionalQueryString(c, "spent_at_order", &query.SpentAtOrder)
}

func assignOptionalQueryString(c *gin.Context, key string, target **string) {
	if value, ok := c.GetQuery(key); ok {
		copied := value
		*target = &copied
	}
}
