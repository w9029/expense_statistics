package analytics

import (
	"context"
	"fmt"

	"expense-statistics-server/internal/platform/db"

	"gorm.io/gorm"
)

type Repository struct{ db *gorm.DB }

func NewRepository(database *db.Database) *Repository { return &Repository{db: database.Gorm} }

func (r *Repository) ListCategoryShare(ctx context.Context, filters analyticsFilters) ([]CategoryShareRecord, error) {
	records := make([]CategoryShareRecord, 0)
	err := r.leafExpenseBaseQuery(ctx, filters).
		Select(`
            e.category_id,
            c.name AS category_name,
            c.color AS category_color,
            COALESCE(SUM(e.converted_amount), 0)::text AS total_converted_amount
        `).
		Group("e.category_id, c.name, c.color").
		Order("SUM(e.converted_amount) DESC").
		Order("c.name ASC").
		Scan(&records).Error
	return records, err
}

func (r *Repository) SumLeafExpenses(ctx context.Context, filters analyticsFilters) (string, error) {
	type aggregateResult struct {
		TotalConvertedAmount string
	}
	result := aggregateResult{}
	err := r.leafExpenseBaseQuery(ctx, filters).
		Select(`COALESCE(SUM(e.converted_amount), 0)::text AS total_converted_amount`).
		Scan(&result).Error
	return result.TotalConvertedAmount, err
}

func (r *Repository) ListTrendPoints(ctx context.Context, params trendParams) ([]TrendPointRecord, error) {
	records := make([]TrendPointRecord, 0)
	bucketExpr := "TO_CHAR(e.spent_at, 'YYYY-MM-DD')"
	if params.Bucket == "month" {
		bucketExpr = "TO_CHAR(DATE_TRUNC('month', e.spent_at::timestamp), 'YYYY-MM')"
	}
	err := r.leafExpenseBaseQuery(ctx, params.analyticsFilters).
		Select(fmt.Sprintf(`
            %s AS bucket,
            COALESCE(SUM(e.converted_amount), 0)::text AS total_converted_amount
        `, bucketExpr)).
		Group("bucket").
		Order("bucket ASC").
		Scan(&records).Error
	return records, err
}

func (r *Repository) leafExpenseBaseQuery(ctx context.Context, filters analyticsFilters) *gorm.DB {
	return r.db.WithContext(ctx).Table("expenses AS e").
		Joins("INNER JOIN expense_categories c ON c.id = e.category_id").
		Where("e.account_book_id = ?", filters.AccountBookID).
		Where("e.deleted_at IS NULL").
		Where("e.expense_type IN ?", []string{"normal", "merged_child"}).
		Where("c.deleted_at IS NULL").
		Where("e.spent_at >= ? AND e.spent_at <= ?", filters.DateFrom.Format("2006-01-02"), filters.DateTo.Format("2006-01-02"))
}
