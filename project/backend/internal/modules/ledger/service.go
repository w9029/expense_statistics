package ledger

import (
	"context"
	"strings"
	"time"

	"expense-statistics-server/internal/modules/authorization"
	"expense-statistics-server/internal/modules/exchange"

	"github.com/google/uuid"
)

type Service struct {
	repo          *Repository
	authorization *authorization.Service
	exchange      *exchange.Service
}

func NewService(repo *Repository, authorizationService *authorization.Service, exchangeService *exchange.Service) *Service {
	return &Service{repo: repo, authorization: authorizationService, exchange: exchangeService}
}

func (s *Service) ListCategories(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) ([]ExpenseCategoryResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "viewer"); err != nil {
		return nil, err
	}
	records, err := s.repo.ListCategories(ctx, accountBookID)
	if err != nil {
		return nil, wrapRepoError("list expense categories", err)
	}
	result := make([]ExpenseCategoryResponse, 0, len(records))
	for _, record := range records {
		result = append(result, toExpenseCategoryResponse(record))
	}
	return result, nil
}

func (s *Service) GetCategory(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, categoryID uuid.UUID) (*ExpenseCategoryResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "viewer"); err != nil {
		return nil, err
	}
	record, err := s.repo.GetCategoryByID(ctx, accountBookID, categoryID)
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("expense category not found")
		}
		return nil, wrapRepoError("get expense category", err)
	}
	response := toExpenseCategoryResponse(*record)
	return &response, nil
}

func (s *Service) CreateCategory(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, req CreateExpenseCategoryRequest) (*ExpenseCategoryResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "editor"); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, invalidRequest("name is required")
	}
	color := strings.TrimSpace(req.Color)
	if !validateColor(color) {
		return nil, invalidRequest("color must be a hex value like #AABBCC")
	}
	record, err := s.repo.CreateCategory(ctx, CreateCategoryParams{
		AccountBookID:   accountBookID,
		Name:            name,
		Description:     normalizeDescription(req.Description),
		IsMergeCategory: req.IsMergeCategory,
		Color:           color,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, conflict("expense category name already exists in this account book")
		}
		return nil, wrapRepoError("create expense category", err)
	}
	response := toExpenseCategoryResponse(*record)
	return &response, nil
}

func (s *Service) UpdateCategory(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, categoryID uuid.UUID, req UpdateExpenseCategoryRequest) (*ExpenseCategoryResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "editor"); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, invalidRequest("name is required")
	}
	color := strings.TrimSpace(req.Color)
	if !validateColor(color) {
		return nil, invalidRequest("color must be a hex value like #AABBCC")
	}
	record, err := s.repo.UpdateCategory(ctx, UpdateCategoryParams{
		AccountBookID:   accountBookID,
		CategoryID:      categoryID,
		Name:            name,
		Description:     normalizeDescription(req.Description),
		IsMergeCategory: req.IsMergeCategory,
		Color:           color,
	})
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("expense category not found")
		}
		if isUniqueViolation(err) {
			return nil, conflict("expense category name already exists in this account book")
		}
		return nil, wrapRepoError("update expense category", err)
	}
	response := toExpenseCategoryResponse(*record)
	return &response, nil
}

func (s *Service) DeleteCategory(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, categoryID uuid.UUID) error {
	if err := s.requireRole(ctx, userID, accountBookID, "editor"); err != nil {
		return err
	}
	if _, err := s.repo.GetCategoryByID(ctx, accountBookID, categoryID); err != nil {
		if isNotFound(err) {
			return notFound("expense category not found")
		}
		return wrapRepoError("get expense category", err)
	}
	count, err := s.repo.CountActiveExpensesByCategory(ctx, accountBookID, categoryID)
	if err != nil {
		return wrapRepoError("count expense category usage", err)
	}
	if count > 0 {
		return conflict("expense category is already used by expenses")
	}
	if err := s.repo.SoftDeleteCategory(ctx, accountBookID, categoryID); err != nil {
		if isNotFound(err) {
			return notFound("expense category not found")
		}
		return wrapRepoError("delete expense category", err)
	}
	return nil
}

func (s *Service) CreateNormalExpense(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, req CreateNormalExpenseRequest) (*ExpenseResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "editor"); err != nil {
		return nil, err
	}
	category, amountCents, rate, convertedCents, spentAt, err := s.prepareExpenseInput(ctx, accountBookID, req.CategoryID, req.OriginalAmount, req.OriginalCurrency, req.SpentAt)
	if err != nil {
		return nil, err
	}
	if category.IsMergeCategory {
		return nil, invalidRequest("normal expenses cannot use a merge category")
	}
	record, err := s.repo.CreateExpense(ctx, CreateExpenseParams{
		AccountBookID:    accountBookID,
		UserID:           userID,
		CategoryID:       req.CategoryID,
		ExpenseType:      "normal",
		ParentID:         nil,
		Name:             strings.TrimSpace(req.Name),
		Description:      normalizeDescription(req.Description),
		OriginalAmount:   formatCents(amountCents),
		OriginalCurrency: normalizeCurrency(req.OriginalCurrency),
		ExchangeRateUsed: rate,
		ConvertedAmount:  formatCents(convertedCents),
		SpentAt:          spentAt,
	})
	if err != nil {
		return nil, wrapRepoError("create normal expense", err)
	}
	response := toExpenseResponse(*record)
	return &response, nil
}

func (s *Service) CreateMergedExpense(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, req CreateMergedExpenseRequest) (*CreateMergedExpenseResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "editor"); err != nil {
		return nil, err
	}
	mode := strings.ToLower(strings.TrimSpace(req.ChildrenAmountInputMode))
	if mode != "pretax" && mode != "posttax" {
		return nil, invalidRequest("children_amount_input_mode must be pretax or posttax")
	}
	if len(req.Children) == 0 {
		return nil, invalidRequest("children are required")
	}

	parentCategory, parentTotalCents, rate, parentConvertedCents, spentAt, err := s.prepareExpenseInput(ctx, accountBookID, req.Parent.CategoryID, req.Parent.TotalOriginalAmount, req.Parent.OriginalCurrency, req.Parent.SpentAt)
	if err != nil {
		return nil, err
	}
	if !parentCategory.IsMergeCategory {
		return nil, invalidRequest("merged expenses must use a merge category for the parent expense")
	}

	childInputCents := make([]int64, 0, len(req.Children))
	for _, child := range req.Children {
		category, err := s.repo.GetCategoryByID(ctx, accountBookID, child.CategoryID)
		if err != nil {
			if isNotFound(err) {
				return nil, notFound("child expense category not found")
			}
			return nil, wrapRepoError("get child expense category", err)
		}
		if category.IsMergeCategory {
			return nil, invalidRequest("merged expense children cannot use merge categories")
		}
		amountCents, err := parseAmountToCents(child.AmountInput)
		if err != nil {
			return nil, invalidRequest(err.Error())
		}
		childInputCents = append(childInputCents, amountCents)
	}

	childFinalCents := make([]int64, len(childInputCents))
	switch mode {
	case "pretax":
		allocated, err := allocateMergedChildrenFromPretax(parentTotalCents, childInputCents)
		if err != nil {
			return nil, invalidRequest(err.Error())
		}
		copy(childFinalCents, allocated)
	case "posttax":
		copy(childFinalCents, childInputCents)
		sum := int64(0)
		for _, cents := range childFinalCents {
			sum += cents
		}
		if sum != parentTotalCents {
			return nil, invalidRequest("children total must equal the merged parent total in posttax mode")
		}
	}

	rateMicros := mustParseRateMicros(rate)
	var createdParent *ExpenseRecord
	createdChildren := make([]ExpenseRecord, 0, len(req.Children))
	err = s.repo.Transaction(ctx, func(repo *Repository) error {
		parent, err := repo.CreateExpense(ctx, CreateExpenseParams{
			AccountBookID:    accountBookID,
			UserID:           userID,
			CategoryID:       req.Parent.CategoryID,
			ExpenseType:      "merged_parent",
			ParentID:         nil,
			Name:             strings.TrimSpace(req.Parent.Name),
			Description:      normalizeDescription(req.Parent.Description),
			OriginalAmount:   formatCents(parentTotalCents),
			OriginalCurrency: normalizeCurrency(req.Parent.OriginalCurrency),
			ExchangeRateUsed: rate,
			ConvertedAmount:  formatCents(parentConvertedCents),
			SpentAt:          spentAt,
		})
		if err != nil {
			return err
		}
		createdParent = parent
		for i, child := range req.Children {
			convertedCents := convertCentsByRate(childFinalCents[i], rateMicros)
			childRecord, err := repo.CreateExpense(ctx, CreateExpenseParams{
				AccountBookID:    accountBookID,
				UserID:           userID,
				CategoryID:       child.CategoryID,
				ExpenseType:      "merged_child",
				ParentID:         &parent.ID,
				Name:             strings.TrimSpace(child.Name),
				Description:      normalizeDescription(child.Description),
				OriginalAmount:   formatCents(childFinalCents[i]),
				OriginalCurrency: normalizeCurrency(req.Parent.OriginalCurrency),
				ExchangeRateUsed: rate,
				ConvertedAmount:  formatCents(convertedCents),
				SpentAt:          spentAt,
			})
			if err != nil {
				return err
			}
			createdChildren = append(createdChildren, *childRecord)
		}
		return nil
	})
	if err != nil {
		return nil, wrapRepoError("create merged expense", err)
	}

	children := make([]ExpenseResponse, 0, len(createdChildren))
	for _, record := range createdChildren {
		children = append(children, toExpenseResponse(record))
	}
	response := &CreateMergedExpenseResponse{Parent: toExpenseResponse(*createdParent), Children: children, ChildrenAmountInputMode: mode}
	return response, nil
}

func (s *Service) ListExpenses(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, query ListExpensesQuery) (*ExpenseListResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "viewer"); err != nil {
		return nil, err
	}
	params, page, pageSize, err := s.normalizeListExpensesParams(accountBookID, query)
	if err != nil {
		return nil, err
	}
	total, err := s.repo.CountRootExpenses(ctx, params)
	if err != nil {
		return nil, wrapRepoError("count expenses", err)
	}
	records, err := s.repo.ListRootExpenses(ctx, params)
	if err != nil {
		return nil, wrapRepoError("list expenses", err)
	}
	items := make([]ExpenseSummaryResponse, 0, len(records))
	for _, record := range records {
		summary := toExpenseSummaryResponse(record)
		if query.IncludeChildren && record.ExpenseType == "merged_parent" && record.ChildrenCount > 0 {
			children, err := s.repo.ListChildrenByParentID(ctx, accountBookID, record.ID)
			if err != nil {
				return nil, wrapRepoError("list merged expense children", err)
			}
			summary.Children = make([]ExpenseResponse, 0, len(children))
			for _, child := range children {
				summary.Children = append(summary.Children, toExpenseResponse(child))
			}
		}
		items = append(items, summary)
	}
	return &ExpenseListResponse{Items: items, Page: page, PageSize: pageSize, Total: total}, nil
}

func (s *Service) GetExpenseDetail(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, expenseID uuid.UUID) (*ExpenseDetailResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "viewer"); err != nil {
		return nil, err
	}
	record, err := s.repo.GetExpenseByID(ctx, accountBookID, expenseID)
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("expense not found")
		}
		return nil, wrapRepoError("get expense detail", err)
	}
	response := &ExpenseDetailResponse{Expense: toExpenseResponse(*record), IsRoot: record.ParentID == nil, RootID: record.ID}
	if record.ParentID != nil {
		response.RootID = *record.ParentID
	}
	if record.ExpenseType == "merged_parent" {
		children, err := s.repo.ListChildrenByParentID(ctx, accountBookID, record.ID)
		if err != nil {
			return nil, wrapRepoError("list merged expense children", err)
		}
		response.Children = make([]ExpenseResponse, 0, len(children))
		for _, child := range children {
			response.Children = append(response.Children, toExpenseResponse(child))
		}
	}
	return response, nil
}

func (s *Service) prepareExpenseInput(ctx context.Context, accountBookID uuid.UUID, categoryID uuid.UUID, originalAmount string, originalCurrency string, spentAt string) (*ExpenseCategoryRecord, int64, string, int64, time.Time, error) {
	category, err := s.repo.GetCategoryByID(ctx, accountBookID, categoryID)
	if err != nil {
		if isNotFound(err) {
			return nil, 0, "", 0, time.Time{}, notFound("expense category not found")
		}
		return nil, 0, "", 0, time.Time{}, wrapRepoError("get expense category", err)
	}
	baseCurrency, err := s.repo.GetAccountBookBaseCurrency(ctx, accountBookID)
	if err != nil {
		if isNotFound(err) {
			return nil, 0, "", 0, time.Time{}, notFound("account book not found")
		}
		return nil, 0, "", 0, time.Time{}, wrapRepoError("get account book base currency", err)
	}
	amountCents, err := parseAmountToCents(originalAmount)
	if err != nil {
		return nil, 0, "", 0, time.Time{}, invalidRequest(err.Error())
	}
	date, err := parseSpentAt(spentAt)
	if err != nil {
		return nil, 0, "", 0, time.Time{}, invalidRequest(err.Error())
	}
	rate, err := s.exchange.ResolveRate(ctx, normalizeCurrency(originalCurrency), baseCurrency, date)
	if err != nil {
		return nil, 0, "", 0, time.Time{}, mapExchangeError(err)
	}
	rateMicros, err := parseRateToMicros(rate)
	if err != nil {
		return nil, 0, "", 0, time.Time{}, invalidRequest(err.Error())
	}
	convertedCents := convertCentsByRate(amountCents, rateMicros)
	return category, amountCents, rate, convertedCents, date, nil
}

func (s *Service) normalizeListExpensesParams(accountBookID uuid.UUID, query ListExpensesQuery) (ListExpensesParams, int, int, error) {
	page := query.Page
	if page <= 0 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	params := ListExpensesParams{AccountBookID: accountBookID, Limit: pageSize, Offset: (page - 1) * pageSize}
	if query.DateFrom != nil && strings.TrimSpace(*query.DateFrom) != "" {
		date, err := parseSpentAt(*query.DateFrom)
		if err != nil {
			return ListExpensesParams{}, 0, 0, invalidRequest(err.Error())
		}
		params.DateFrom = &date
	}
	if query.DateTo != nil && strings.TrimSpace(*query.DateTo) != "" {
		date, err := parseSpentAt(*query.DateTo)
		if err != nil {
			return ListExpensesParams{}, 0, 0, invalidRequest(err.Error())
		}
		params.DateTo = &date
	}
	if params.DateFrom != nil && params.DateTo != nil && params.DateFrom.After(*params.DateTo) {
		return ListExpensesParams{}, 0, 0, invalidRequest("date_from cannot be after date_to")
	}
	if query.CategoryID != nil && strings.TrimSpace(*query.CategoryID) != "" {
		categoryID, err := uuid.Parse(strings.TrimSpace(*query.CategoryID))
		if err != nil {
			return ListExpensesParams{}, 0, 0, invalidRequest("invalid category_id")
		}
		params.CategoryID = &categoryID
	}
	if query.Keyword != nil && strings.TrimSpace(*query.Keyword) != "" {
		keyword := strings.TrimSpace(*query.Keyword)
		params.Keyword = &keyword
	}
	return params, page, pageSize, nil
}

func (s *Service) requireRole(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, minimumRole string) error {
	role, err := s.authorization.GetAccountBookRole(ctx, userID, accountBookID)
	if err != nil {
		return mapAuthorizationError(err)
	}
	if !authorization.CanAccessRole(role, minimumRole) {
		return forbidden("you do not have permission to perform this action")
	}
	return nil
}

func mapAuthorizationError(err error) *AppError {
	if appErr, ok := err.(*authorization.AppError); ok {
		return &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
	}
	return internalError(err.Error())
}

func mapExchangeError(err error) *AppError {
	if appErr, ok := err.(*exchange.AppError); ok {
		return &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
	}
	return internalError(err.Error())
}

func mustParseRateMicros(rate string) int64 {
	micros, err := parseRateToMicros(rate)
	if err != nil {
		panic(err)
	}
	return micros
}
