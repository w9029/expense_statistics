package ledger

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"expense-statistics-server/internal/platform/db"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

type CreateCategoryParams struct {
	AccountBookID   uuid.UUID
	Name            string
	Description     *string
	IsMergeCategory bool
	Color           string
}

type UpdateCategoryParams struct {
	AccountBookID   uuid.UUID
	CategoryID      uuid.UUID
	Name            string
	Description     *string
	IsMergeCategory bool
	Color           string
}

type CreateExpenseParams struct {
	AccountBookID    uuid.UUID
	UserID           uuid.UUID
	CategoryID       uuid.UUID
	ExpenseType      string
	ParentID         *uuid.UUID
	Name             string
	Description      *string
	OriginalAmount   string
	OriginalCurrency string
	ExchangeRateUsed string
	ConvertedAmount  string
	SpentAt          time.Time
}

type UpdateExpenseParams struct {
	AccountBookID    uuid.UUID
	ExpenseID        uuid.UUID
	CategoryID       uuid.UUID
	Name             string
	Description      *string
	OriginalAmount   string
	OriginalCurrency string
	ExchangeRateUsed string
	ConvertedAmount  string
	SpentAt          time.Time
}

type ListExpensesParams struct {
	AccountBookID    uuid.UUID
	DateFrom         *time.Time
	DateTo           *time.Time
	CategoryIDs      []uuid.UUID
	UserID           *uuid.UUID
	MinAmount        *string
	MaxAmount        *string
	OriginalCurrency *string
	Keyword          *string
	SortAscending    bool
	Limit            int
	Offset           int
}

type Repository struct{ db *gorm.DB }

func NewRepository(database *db.Database) *Repository { return &Repository{db: database.Gorm} }
func (r *Repository) WithTx(tx *gorm.DB) *Repository  { return &Repository{db: tx} }
func (r *Repository) Transaction(ctx context.Context, fn func(repo *Repository) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error { return fn(r.WithTx(tx)) })
}

func (r *Repository) GetAccountBookBaseCurrency(ctx context.Context, accountBookID uuid.UUID) (string, error) {
	var currency string
	err := r.db.WithContext(ctx).Raw(`SELECT base_currency FROM account_books WHERE id = ? AND deleted_at IS NULL LIMIT 1`, accountBookID).Scan(&currency).Error
	if err != nil {
		return "", err
	}
	if currency == "" {
		return "", gorm.ErrRecordNotFound
	}
	return currency, nil
}

func (r *Repository) ListCategories(ctx context.Context, accountBookID uuid.UUID) ([]ExpenseCategoryRecord, error) {
	var records []ExpenseCategoryRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT id, account_book_id, name, description, is_merge_category, color, is_system_seed, created_at, updated_at
        FROM expense_categories
        WHERE account_book_id = ? AND deleted_at IS NULL
        ORDER BY is_system_seed DESC, is_merge_category ASC, name ASC
    `, accountBookID).Scan(&records).Error
	return records, err
}

func (r *Repository) GetCategoryByID(ctx context.Context, accountBookID uuid.UUID, categoryID uuid.UUID) (*ExpenseCategoryRecord, error) {
	var record ExpenseCategoryRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT id, account_book_id, name, description, is_merge_category, color, is_system_seed, created_at, updated_at
        FROM expense_categories
        WHERE account_book_id = ? AND id = ? AND deleted_at IS NULL
        LIMIT 1
    `, accountBookID, categoryID).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func (r *Repository) CreateCategory(ctx context.Context, params CreateCategoryParams) (*ExpenseCategoryRecord, error) {
	var record ExpenseCategoryRecord
	err := r.db.WithContext(ctx).Raw(`
        INSERT INTO expense_categories (account_book_id, name, description, is_merge_category, color)
        VALUES (?, ?, ?, ?, ?)
        RETURNING id, account_book_id, name, description, is_merge_category, color, is_system_seed, created_at, updated_at
    `, params.AccountBookID, params.Name, params.Description, params.IsMergeCategory, params.Color).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *Repository) UpdateCategory(ctx context.Context, params UpdateCategoryParams) (*ExpenseCategoryRecord, error) {
	var record ExpenseCategoryRecord
	err := r.db.WithContext(ctx).Raw(`
        UPDATE expense_categories
        SET name = ?, description = ?, is_merge_category = ?, color = ?, updated_at = now()
        WHERE account_book_id = ? AND id = ? AND deleted_at IS NULL
        RETURNING id, account_book_id, name, description, is_merge_category, color, is_system_seed, created_at, updated_at
    `, params.Name, params.Description, params.IsMergeCategory, params.Color, params.AccountBookID, params.CategoryID).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func (r *Repository) SoftDeleteCategory(ctx context.Context, accountBookID uuid.UUID, categoryID uuid.UUID) error {
	result := r.db.WithContext(ctx).Exec(`UPDATE expense_categories SET deleted_at = now(), updated_at = now() WHERE account_book_id = ? AND id = ? AND deleted_at IS NULL`, accountBookID, categoryID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) CountActiveExpensesByCategory(ctx context.Context, accountBookID uuid.UUID, categoryID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Raw(`
        SELECT COUNT(*)
        FROM expenses
        WHERE account_book_id = ? AND category_id = ? AND deleted_at IS NULL
    `, accountBookID, categoryID).Scan(&count).Error
	return count, err
}

func (r *Repository) CreateExpense(ctx context.Context, params CreateExpenseParams) (*ExpenseRecord, error) {
	var record ExpenseRecord
	err := r.db.WithContext(ctx).Raw(`
        INSERT INTO expenses (
            account_book_id, user_id, category_id, expense_type, parent_id, name, description,
            original_amount, original_currency, exchange_rate_used, converted_amount, spent_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS numeric(12,2)), ?, CAST(? AS numeric(12,6)), CAST(? AS numeric(12,2)), ?)
        RETURNING id, account_book_id, user_id, category_id, expense_type, parent_id, name, description,
                  original_amount::text AS original_amount, original_currency,
                  exchange_rate_used::text AS exchange_rate_used, converted_amount::text AS converted_amount,
                  spent_at, created_at, updated_at
    `, params.AccountBookID, params.UserID, params.CategoryID, params.ExpenseType, params.ParentID, params.Name, params.Description,
		params.OriginalAmount, params.OriginalCurrency, params.ExchangeRateUsed, params.ConvertedAmount, params.SpentAt.Format("2006-01-02")).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *Repository) UpdateExpense(ctx context.Context, params UpdateExpenseParams) (*ExpenseRecord, error) {
	var record ExpenseRecord
	err := r.db.WithContext(ctx).Raw(`
        UPDATE expenses
        SET category_id = ?,
            name = ?,
            description = ?,
            original_amount = CAST(? AS numeric(12,2)),
            original_currency = ?,
            exchange_rate_used = CAST(? AS numeric(12,6)),
            converted_amount = CAST(? AS numeric(12,2)),
            spent_at = ?,
            updated_at = now()
        WHERE account_book_id = ? AND id = ? AND deleted_at IS NULL
        RETURNING id, account_book_id, user_id, category_id, expense_type, parent_id, name, description,
                  original_amount::text AS original_amount, original_currency,
                  exchange_rate_used::text AS exchange_rate_used, converted_amount::text AS converted_amount,
                  spent_at, created_at, updated_at
    `, params.CategoryID, params.Name, params.Description, params.OriginalAmount, params.OriginalCurrency,
		params.ExchangeRateUsed, params.ConvertedAmount, params.SpentAt.Format("2006-01-02"), params.AccountBookID, params.ExpenseID).
		Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func (r *Repository) CountRootExpenses(ctx context.Context, params ListExpensesParams) (int64, error) {
	query := r.rootExpenseBaseQuery(ctx, params)
	var count int64
	err := query.Count(&count).Error
	return count, err
}

func (r *Repository) SumRootExpensesConvertedAmount(ctx context.Context, params ListExpensesParams) (string, error) {
	type aggregateResult struct {
		TotalConvertedAmount string
	}

	query := r.rootExpenseBaseQuery(ctx, params)
	result := aggregateResult{}
	if len(params.CategoryIDs) > 0 {
		err := query.
			Select(`
                COALESCE(
                    SUM(
                        CASE
                            WHEN e.category_id IN ? THEN e.converted_amount
                            ELSE COALESCE(matched_child_counts.matched_children_converted_amount, 0)
                        END
                    ),
                    0
                )::text AS total_converted_amount
            `, params.CategoryIDs).
			Scan(&result).Error
		return result.TotalConvertedAmount, err
	}

	err := query.
		Select(`COALESCE(SUM(e.converted_amount), 0)::text AS total_converted_amount`).
		Scan(&result).Error
	return result.TotalConvertedAmount, err
}

func (r *Repository) ListRootExpenses(ctx context.Context, params ListExpensesParams) ([]ExpenseRecord, error) {
	records := make([]ExpenseRecord, 0)
	spentAtOrder := "DESC"
	createdAtOrder := "DESC"
	idOrder := "DESC"
	if params.SortAscending {
		spentAtOrder = "ASC"
		createdAtOrder = "ASC"
		idOrder = "ASC"
	}
	query := r.rootExpenseBaseQuery(ctx, params).
		Select(`
            e.id,
            e.account_book_id,
            e.user_id,
            e.category_id,
            e.expense_type,
            e.parent_id,
            e.name,
            e.description,
            e.original_amount::text AS original_amount,
            e.original_currency,
            e.exchange_rate_used::text AS exchange_rate_used,
            e.converted_amount::text AS converted_amount,
            e.spent_at,
            e.created_at,
            e.updated_at,
            COALESCE(child_counts.children_count, 0) AS children_count,
            COALESCE(matched_child_counts.matched_children_count, 0) AS matched_children_count,
            COALESCE(matched_child_counts.matched_children_converted_amount, 0)::text AS matched_children_converted_amount
        `).
		Order("e.spent_at " + spentAtOrder).
		Order("e.created_at " + createdAtOrder).
		Order("e.id " + idOrder).
		Limit(params.Limit).
		Offset(params.Offset)
	err := query.Scan(&records).Error
	return records, err
}

func (r *Repository) GetExpenseByID(ctx context.Context, accountBookID uuid.UUID, expenseID uuid.UUID) (*ExpenseRecord, error) {
	var record ExpenseRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT e.id, e.account_book_id, e.user_id, e.category_id, e.expense_type, e.parent_id, e.name, e.description,
               e.original_amount::text AS original_amount, e.original_currency,
               e.exchange_rate_used::text AS exchange_rate_used, e.converted_amount::text AS converted_amount,
               e.spent_at, e.created_at, e.updated_at,
               COALESCE(child_counts.children_count, 0) AS children_count
        FROM expenses e
        LEFT JOIN (
            SELECT parent_id, COUNT(*) AS children_count
            FROM expenses
            WHERE deleted_at IS NULL AND expense_type = 'merged_child'
            GROUP BY parent_id
        ) child_counts ON child_counts.parent_id = e.id
        WHERE e.account_book_id = ? AND e.id = ? AND e.deleted_at IS NULL
        LIMIT 1
    `, accountBookID, expenseID).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func (r *Repository) ListChildrenByParentID(ctx context.Context, accountBookID uuid.UUID, parentID uuid.UUID) ([]ExpenseRecord, error) {
	return r.listChildrenByParentID(ctx, accountBookID, parentID, nil)
}

func (r *Repository) ListChildrenByParentIDMatchingCategories(ctx context.Context, accountBookID uuid.UUID, parentID uuid.UUID, categoryIDs []uuid.UUID) ([]ExpenseRecord, error) {
	return r.listChildrenByParentID(ctx, accountBookID, parentID, categoryIDs)
}

func (r *Repository) SoftDeleteExpenseByID(ctx context.Context, accountBookID uuid.UUID, expenseID uuid.UUID) error {
	result := r.db.WithContext(ctx).Exec(`
        UPDATE expenses
        SET deleted_at = now(), updated_at = now()
        WHERE account_book_id = ? AND id = ? AND deleted_at IS NULL
    `, accountBookID, expenseID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) SoftDeleteChildrenByParentID(ctx context.Context, accountBookID uuid.UUID, parentID uuid.UUID) error {
	return r.db.WithContext(ctx).Exec(`
        UPDATE expenses
        SET deleted_at = now(), updated_at = now()
        WHERE account_book_id = ? AND parent_id = ? AND deleted_at IS NULL
    `, accountBookID, parentID).Error
}

func (r *Repository) rootExpenseBaseQuery(ctx context.Context, params ListExpensesParams) *gorm.DB {
	childCountSubquery := r.db.Table("expenses").
		Select("parent_id, COUNT(*) AS children_count").
		Where("deleted_at IS NULL AND expense_type = ?", "merged_child").
		Group("parent_id")
	matchedChildSubquery := r.matchedChildAggregateSubquery(params)

	query := r.db.WithContext(ctx).Table("expenses AS e").
		Joins("LEFT JOIN (?) AS child_counts ON child_counts.parent_id = e.id", childCountSubquery).
		Joins("LEFT JOIN (?) AS matched_child_counts ON matched_child_counts.parent_id = e.id", matchedChildSubquery).
		Where("e.account_book_id = ?", params.AccountBookID).
		Where("e.deleted_at IS NULL").
		Where("e.parent_id IS NULL")
	if params.DateFrom != nil {
		query = query.Where("e.spent_at >= ?", params.DateFrom.Format("2006-01-02"))
	}
	if params.DateTo != nil {
		query = query.Where("e.spent_at <= ?", params.DateTo.Format("2006-01-02"))
	}
	if len(params.CategoryIDs) > 0 {
		query = query.Where("(e.category_id IN ? OR COALESCE(matched_child_counts.matched_children_count, 0) > 0)", params.CategoryIDs)
	}
	if params.UserID != nil {
		query = query.Where("e.user_id = ?", *params.UserID)
	}
	if params.MinAmount != nil {
		query = query.Where("e.converted_amount >= CAST(? AS numeric(12,2))", *params.MinAmount)
	}
	if params.MaxAmount != nil {
		query = query.Where("e.converted_amount <= CAST(? AS numeric(12,2))", *params.MaxAmount)
	}
	if params.OriginalCurrency != nil {
		query = query.Where("e.original_currency = ?", *params.OriginalCurrency)
	}
	if params.Keyword != nil && strings.TrimSpace(*params.Keyword) != "" {
		keyword := "%" + strings.TrimSpace(*params.Keyword) + "%"
		query = query.Where("(e.name ILIKE ? OR COALESCE(e.description, '') ILIKE ?)", keyword, keyword)
	}
	return query
}

func (r *Repository) matchedChildAggregateSubquery(params ListExpensesParams) *gorm.DB {
	query := r.db.Table("expenses").
		Select("parent_id, COUNT(*) AS matched_children_count, COALESCE(SUM(converted_amount), 0) AS matched_children_converted_amount").
		Where("deleted_at IS NULL AND expense_type = ?", "merged_child")
	if len(params.CategoryIDs) > 0 {
		query = query.Where("category_id IN ?", params.CategoryIDs)
	} else {
		query = query.Where("1 = 0")
	}
	return query.Group("parent_id")
}

func (r *Repository) listChildrenByParentID(ctx context.Context, accountBookID uuid.UUID, parentID uuid.UUID, categoryIDs []uuid.UUID) ([]ExpenseRecord, error) {
	var records []ExpenseRecord
	query := r.db.WithContext(ctx).Table("expenses").
		Select(`
            id, account_book_id, user_id, category_id, expense_type, parent_id, name, description,
            original_amount::text AS original_amount, original_currency,
            exchange_rate_used::text AS exchange_rate_used, converted_amount::text AS converted_amount,
            spent_at, created_at, updated_at,
            0 AS children_count,
            0 AS matched_children_count,
            '0' AS matched_children_converted_amount
        `).
		Where("account_book_id = ? AND parent_id = ? AND deleted_at IS NULL", accountBookID, parentID)
	if len(categoryIDs) > 0 {
		query = query.Where("category_id IN ?", categoryIDs)
	}
	err := query.Order("created_at ASC").Order("id ASC").Scan(&records).Error
	return records, err
}

func isNotFound(err error) bool { return errors.Is(err, gorm.ErrRecordNotFound) }

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func wrapRepoError(message string, err error) *AppError {
	return internalError(fmt.Sprintf("%s: %v", message, err))
}

func normalizeDescription(description *string) *string {
	if description == nil {
		return nil
	}
	value := strings.TrimSpace(*description)
	if value == "" {
		return nil
	}
	return &value
}
