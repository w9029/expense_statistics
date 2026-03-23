package exchange

import (
	"context"
	"errors"
	"fmt"
	"time"

	"expense-statistics-server/internal/platform/db"

	"gorm.io/gorm"
)

type Repository struct{ db *gorm.DB }

func NewRepository(database *db.Database) *Repository { return &Repository{db: database.Gorm} }

func (r *Repository) GetRate(ctx context.Context, sourceCurrency string, targetCurrency string, rateDate time.Time) (string, error) {
	var record ExchangeRateRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT rate::text AS rate
        FROM exchange_rates
        WHERE base_currency = ? AND target_currency = ? AND rate_date = ?
        LIMIT 1
    `, sourceCurrency, targetCurrency, rateDate.Format("2006-01-02")).Scan(&record).Error
	if err != nil {
		return "", err
	}
	if record.Rate == "" {
		return "", gorm.ErrRecordNotFound
	}
	return record.Rate, nil
}

func isNotFound(err error) bool { return errors.Is(err, gorm.ErrRecordNotFound) }
func wrapRepoError(message string, err error) *AppError {
	return internalError(fmt.Sprintf("%s: %v", message, err))
}
