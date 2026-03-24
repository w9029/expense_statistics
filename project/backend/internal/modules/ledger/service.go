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

type preparedMergedExpense struct {
	mode                 string
	parentCategoryID     uuid.UUID
	parentName           string
	parentDescription    *string
	parentTotalCents     int64
	parentCurrency       string
	parentExchangeRate   string
	parentConvertedCents int64
	spentAt              time.Time
	rateMicros           int64
	children             []preparedMergedChild
}

type preparedMergedChild struct {
	categoryID  uuid.UUID
	name        string
	description *string
	finalCents  int64
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
	name, err := normalizeRequiredName(req.Name)
	if err != nil {
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
		Name:             name,
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

func (s *Service) UpdateNormalExpense(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, expenseID uuid.UUID, req UpdateNormalExpenseRequest) (*ExpenseResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "editor"); err != nil {
		return nil, err
	}
	existing, err := s.repo.GetExpenseByID(ctx, accountBookID, expenseID)
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("expense not found")
		}
		return nil, wrapRepoError("get expense", err)
	}
	if existing.ParentID != nil {
		return nil, invalidRequest("merged child expenses cannot be updated directly")
	}
	if existing.ExpenseType != "normal" {
		return nil, invalidRequest("expense is not a normal expense")
	}
	name, err := normalizeRequiredName(req.Name)
	if err != nil {
		return nil, err
	}
	category, amountCents, rate, convertedCents, spentAt, err := s.prepareExpenseInput(ctx, accountBookID, req.CategoryID, req.OriginalAmount, req.OriginalCurrency, req.SpentAt)
	if err != nil {
		return nil, err
	}
	if category.IsMergeCategory {
		return nil, invalidRequest("normal expenses cannot use a merge category")
	}
	record, err := s.repo.UpdateExpense(ctx, UpdateExpenseParams{
		AccountBookID:    accountBookID,
		ExpenseID:        expenseID,
		CategoryID:       req.CategoryID,
		Name:             name,
		Description:      normalizeDescription(req.Description),
		OriginalAmount:   formatCents(amountCents),
		OriginalCurrency: normalizeCurrency(req.OriginalCurrency),
		ExchangeRateUsed: rate,
		ConvertedAmount:  formatCents(convertedCents),
		SpentAt:          spentAt,
	})
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("expense not found")
		}
		return nil, wrapRepoError("update normal expense", err)
	}
	response := toExpenseResponse(*record)
	return &response, nil
}

func (s *Service) CreateMergedExpense(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, req CreateMergedExpenseRequest) (*CreateMergedExpenseResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "editor"); err != nil {
		return nil, err
	}
	prepared, err := s.prepareMergedExpensePayload(ctx, accountBookID, req.Parent, req.ChildrenAmountInputMode, req.Children)
	if err != nil {
		return nil, err
	}
	var createdParent *ExpenseRecord
	createdChildren := make([]ExpenseRecord, 0, len(prepared.children))
	err = s.repo.Transaction(ctx, func(repo *Repository) error {
		parent, err := repo.CreateExpense(ctx, CreateExpenseParams{
			AccountBookID:    accountBookID,
			UserID:           userID,
			CategoryID:       prepared.parentCategoryID,
			ExpenseType:      "merged_parent",
			ParentID:         nil,
			Name:             prepared.parentName,
			Description:      prepared.parentDescription,
			OriginalAmount:   formatCents(prepared.parentTotalCents),
			OriginalCurrency: prepared.parentCurrency,
			ExchangeRateUsed: prepared.parentExchangeRate,
			ConvertedAmount:  formatCents(prepared.parentConvertedCents),
			SpentAt:          prepared.spentAt,
		})
		if err != nil {
			return err
		}
		createdParent = parent
		for _, child := range prepared.children {
			convertedCents := convertCentsByRate(child.finalCents, prepared.rateMicros)
			childRecord, err := repo.CreateExpense(ctx, CreateExpenseParams{
				AccountBookID:    accountBookID,
				UserID:           userID,
				CategoryID:       child.categoryID,
				ExpenseType:      "merged_child",
				ParentID:         &parent.ID,
				Name:             child.name,
				Description:      child.description,
				OriginalAmount:   formatCents(child.finalCents),
				OriginalCurrency: prepared.parentCurrency,
				ExchangeRateUsed: prepared.parentExchangeRate,
				ConvertedAmount:  formatCents(convertedCents),
				SpentAt:          prepared.spentAt,
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
	response := &CreateMergedExpenseResponse{Parent: toExpenseResponse(*createdParent), Children: children, ChildrenAmountInputMode: prepared.mode}
	return response, nil
}

func (s *Service) UpdateMergedExpense(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, expenseID uuid.UUID, req UpdateMergedExpenseRequest) (*CreateMergedExpenseResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "editor"); err != nil {
		return nil, err
	}
	existing, err := s.repo.GetExpenseByID(ctx, accountBookID, expenseID)
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("expense not found")
		}
		return nil, wrapRepoError("get expense", err)
	}
	if existing.ParentID != nil {
		return nil, invalidRequest("merged child expenses cannot be updated directly")
	}
	if existing.ExpenseType != "merged_parent" {
		return nil, invalidRequest("expense is not a merged parent expense")
	}
	prepared, err := s.prepareMergedExpensePayload(ctx, accountBookID, req.Parent, req.ChildrenAmountInputMode, req.Children)
	if err != nil {
		return nil, err
	}
	var updatedParent *ExpenseRecord
	updatedChildren := make([]ExpenseRecord, 0, len(prepared.children))
	err = s.repo.Transaction(ctx, func(repo *Repository) error {
		parent, err := repo.UpdateExpense(ctx, UpdateExpenseParams{
			AccountBookID:    accountBookID,
			ExpenseID:        expenseID,
			CategoryID:       prepared.parentCategoryID,
			Name:             prepared.parentName,
			Description:      prepared.parentDescription,
			OriginalAmount:   formatCents(prepared.parentTotalCents),
			OriginalCurrency: prepared.parentCurrency,
			ExchangeRateUsed: prepared.parentExchangeRate,
			ConvertedAmount:  formatCents(prepared.parentConvertedCents),
			SpentAt:          prepared.spentAt,
		})
		if err != nil {
			return err
		}
		updatedParent = parent
		if err := repo.SoftDeleteChildrenByParentID(ctx, accountBookID, expenseID); err != nil {
			return err
		}
		for _, child := range prepared.children {
			convertedCents := convertCentsByRate(child.finalCents, prepared.rateMicros)
			childRecord, err := repo.CreateExpense(ctx, CreateExpenseParams{
				AccountBookID:    accountBookID,
				UserID:           userID,
				CategoryID:       child.categoryID,
				ExpenseType:      "merged_child",
				ParentID:         &expenseID,
				Name:             child.name,
				Description:      child.description,
				OriginalAmount:   formatCents(child.finalCents),
				OriginalCurrency: prepared.parentCurrency,
				ExchangeRateUsed: prepared.parentExchangeRate,
				ConvertedAmount:  formatCents(convertedCents),
				SpentAt:          prepared.spentAt,
			})
			if err != nil {
				return err
			}
			updatedChildren = append(updatedChildren, *childRecord)
		}
		return nil
	})
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("expense not found")
		}
		return nil, wrapRepoError("update merged expense", err)
	}
	children := make([]ExpenseResponse, 0, len(updatedChildren))
	for _, record := range updatedChildren {
		children = append(children, toExpenseResponse(record))
	}
	response := &CreateMergedExpenseResponse{Parent: toExpenseResponse(*updatedParent), Children: children, ChildrenAmountInputMode: prepared.mode}
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
	totalConvertedAmount, err := s.repo.SumRootExpensesConvertedAmount(ctx, params)
	if err != nil {
		return nil, wrapRepoError("sum expense amounts", err)
	}
	records, err := s.repo.ListRootExpenses(ctx, params)
	if err != nil {
		return nil, wrapRepoError("list expenses", err)
	}
	filteredCategoryIDs := make(map[uuid.UUID]struct{}, len(params.CategoryIDs))
	for _, categoryID := range params.CategoryIDs {
		filteredCategoryIDs[categoryID] = struct{}{}
	}
	items := make([]ExpenseSummaryResponse, 0, len(records))
	for _, record := range records {
		summary := toExpenseSummaryResponse(record)
		if query.IncludeChildren && record.ExpenseType == "merged_parent" && record.ChildrenCount > 0 {
			children, err := s.listExpenseChildren(ctx, accountBookID, record, filteredCategoryIDs)
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
	return &ExpenseListResponse{
		Items:                items,
		Page:                 page,
		PageSize:             pageSize,
		Total:                total,
		TotalConvertedAmount: totalConvertedAmount,
	}, nil
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

func (s *Service) DeleteExpense(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, expenseID uuid.UUID) (*DeleteExpenseResponse, error) {
	if err := s.requireRole(ctx, userID, accountBookID, "editor"); err != nil {
		return nil, err
	}
	record, err := s.repo.GetExpenseByID(ctx, accountBookID, expenseID)
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("expense not found")
		}
		return nil, wrapRepoError("get expense", err)
	}
	if record.ParentID != nil {
		return nil, invalidRequest("merged child expenses cannot be deleted directly")
	}
	if err := s.repo.Transaction(ctx, func(repo *Repository) error {
		if record.ExpenseType == "merged_parent" {
			if err := repo.SoftDeleteChildrenByParentID(ctx, accountBookID, expenseID); err != nil {
				return err
			}
		}
		return repo.SoftDeleteExpenseByID(ctx, accountBookID, expenseID)
	}); err != nil {
		if isNotFound(err) {
			return nil, notFound("expense not found")
		}
		return nil, wrapRepoError("delete expense", err)
	}
	return &DeleteExpenseResponse{ExpenseID: expenseID, RootID: expenseID, Deleted: true}, nil
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

func (s *Service) prepareMergedExpensePayload(ctx context.Context, accountBookID uuid.UUID, parent MergedExpenseParentInput, modeInput string, children []MergedExpenseChildInput) (*preparedMergedExpense, error) {
	mode := strings.ToLower(strings.TrimSpace(modeInput))
	if mode != "pretax" && mode != "posttax" {
		return nil, invalidRequest("children_amount_input_mode must be pretax or posttax")
	}
	if len(children) == 0 {
		return nil, invalidRequest("children are required")
	}
	parentName, err := normalizeRequiredName(parent.Name)
	if err != nil {
		return nil, err
	}
	parentCategory, parentTotalCents, rate, parentConvertedCents, spentAt, err := s.prepareExpenseInput(ctx, accountBookID, parent.CategoryID, parent.TotalOriginalAmount, parent.OriginalCurrency, parent.SpentAt)
	if err != nil {
		return nil, err
	}
	if !parentCategory.IsMergeCategory {
		return nil, invalidRequest("merged expenses must use a merge category for the parent expense")
	}
	childInputCents := make([]int64, 0, len(children))
	preparedChildren := make([]preparedMergedChild, 0, len(children))
	for _, child := range children {
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
		name, err := normalizeRequiredName(child.Name)
		if err != nil {
			return nil, err
		}
		amountCents, err := parseAmountToCents(child.AmountInput)
		if err != nil {
			return nil, invalidRequest(err.Error())
		}
		childInputCents = append(childInputCents, amountCents)
		preparedChildren = append(preparedChildren, preparedMergedChild{
			categoryID:  child.CategoryID,
			name:        name,
			description: normalizeDescription(child.Description),
		})
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
	for i := range preparedChildren {
		preparedChildren[i].finalCents = childFinalCents[i]
	}
	rateMicros := mustParseRateMicros(rate)
	return &preparedMergedExpense{
		mode:                 mode,
		parentCategoryID:     parent.CategoryID,
		parentName:           parentName,
		parentDescription:    normalizeDescription(parent.Description),
		parentTotalCents:     parentTotalCents,
		parentCurrency:       normalizeCurrency(parent.OriginalCurrency),
		parentExchangeRate:   rate,
		parentConvertedCents: parentConvertedCents,
		spentAt:              spentAt,
		rateMicros:           rateMicros,
		children:             preparedChildren,
	}, nil
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
	params := ListExpensesParams{
		AccountBookID: accountBookID,
		SortAscending: false,
		Limit:         pageSize,
		Offset:        (page - 1) * pageSize,
	}
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
	categoryIDs, err := parseCategoryFilters(query.CategoryID, query.CategoryIDs)
	if err != nil {
		return ListExpensesParams{}, 0, 0, err
	}
	if len(categoryIDs) > 0 {
		params.CategoryIDs = categoryIDs
	}
	if query.UserID != nil && strings.TrimSpace(*query.UserID) != "" {
		filterUserID, err := uuid.Parse(strings.TrimSpace(*query.UserID))
		if err != nil {
			return ListExpensesParams{}, 0, 0, invalidRequest("invalid user_id")
		}
		params.UserID = &filterUserID
	}
	if query.MinAmount != nil && strings.TrimSpace(*query.MinAmount) != "" {
		minAmountCents, err := parseAmountToCents(*query.MinAmount)
		if err != nil {
			return ListExpensesParams{}, 0, 0, invalidRequest("invalid min_amount")
		}
		minAmount := formatCents(minAmountCents)
		params.MinAmount = &minAmount
	}
	if query.MaxAmount != nil && strings.TrimSpace(*query.MaxAmount) != "" {
		maxAmountCents, err := parseAmountToCents(*query.MaxAmount)
		if err != nil {
			return ListExpensesParams{}, 0, 0, invalidRequest("invalid max_amount")
		}
		maxAmount := formatCents(maxAmountCents)
		params.MaxAmount = &maxAmount
	}
	if params.MinAmount != nil && params.MaxAmount != nil {
		minAmountCents, _ := parseAmountToCents(*params.MinAmount)
		maxAmountCents, _ := parseAmountToCents(*params.MaxAmount)
		if minAmountCents > maxAmountCents {
			return ListExpensesParams{}, 0, 0, invalidRequest("min_amount cannot be greater than max_amount")
		}
	}
	if query.OriginalCurrency != nil && strings.TrimSpace(*query.OriginalCurrency) != "" {
		currency := normalizeCurrency(*query.OriginalCurrency)
		if !isCurrencyCode(currency) {
			return ListExpensesParams{}, 0, 0, invalidRequest("original_currency must be 3 uppercase letters")
		}
		params.OriginalCurrency = &currency
	}
	if query.Keyword != nil && strings.TrimSpace(*query.Keyword) != "" {
		keyword := strings.TrimSpace(*query.Keyword)
		params.Keyword = &keyword
	}
	if query.SpentAtOrder != nil && strings.TrimSpace(*query.SpentAtOrder) != "" {
		switch strings.ToLower(strings.TrimSpace(*query.SpentAtOrder)) {
		case "asc":
			params.SortAscending = true
		case "desc":
			params.SortAscending = false
		default:
			return ListExpensesParams{}, 0, 0, invalidRequest("spent_at_order must be asc or desc")
		}
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

func (s *Service) listExpenseChildren(ctx context.Context, accountBookID uuid.UUID, record ExpenseRecord, filteredCategoryIDs map[uuid.UUID]struct{}) ([]ExpenseRecord, error) {
	if len(filteredCategoryIDs) == 0 {
		return s.repo.ListChildrenByParentID(ctx, accountBookID, record.ID)
	}
	if _, rootCategoryMatched := filteredCategoryIDs[record.CategoryID]; rootCategoryMatched {
		return s.repo.ListChildrenByParentID(ctx, accountBookID, record.ID)
	}
	if record.MatchedChildrenCount == 0 {
		return []ExpenseRecord{}, nil
	}
	categoryIDs := make([]uuid.UUID, 0, len(filteredCategoryIDs))
	for categoryID := range filteredCategoryIDs {
		categoryIDs = append(categoryIDs, categoryID)
	}
	return s.repo.ListChildrenByParentIDMatchingCategories(ctx, accountBookID, record.ID, categoryIDs)
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

func normalizeRequiredName(value string) (string, error) {
	name := strings.TrimSpace(value)
	if name == "" {
		return "", invalidRequest("name is required")
	}
	return name, nil
}

func parseCategoryFilters(singleCategoryID *string, multipleCategoryIDs *string) ([]uuid.UUID, error) {
	values := make([]string, 0, 2)
	if singleCategoryID != nil && strings.TrimSpace(*singleCategoryID) != "" {
		values = append(values, strings.TrimSpace(*singleCategoryID))
	}
	if multipleCategoryIDs != nil && strings.TrimSpace(*multipleCategoryIDs) != "" {
		values = append(values, strings.Split(strings.TrimSpace(*multipleCategoryIDs), ",")...)
	}
	if len(values) == 0 {
		return nil, nil
	}
	seen := make(map[uuid.UUID]struct{}, len(values))
	categoryIDs := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		categoryID, err := uuid.Parse(trimmed)
		if err != nil {
			return nil, invalidRequest("invalid category_ids")
		}
		if _, exists := seen[categoryID]; exists {
			continue
		}
		seen[categoryID] = struct{}{}
		categoryIDs = append(categoryIDs, categoryID)
	}
	return categoryIDs, nil
}
