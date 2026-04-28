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

func (r *Repository) FindLatestRateInWindow(ctx context.Context, sourceCurrency string, targetCurrency string, startDate time.Time, endDate time.Time) (*ExchangeRateRecord, error) {
	var record ExchangeRateRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT base_currency, target_currency, rate::text AS rate, rate_date
        FROM exchange_rates
        WHERE ((base_currency = ? AND target_currency = ?) OR (base_currency = ? AND target_currency = ?))
          AND rate_date BETWEEN ? AND ?
        ORDER BY rate_date DESC,
                 CASE WHEN base_currency = ? AND target_currency = ? THEN 0 ELSE 1 END ASC
        LIMIT 1
    `,
		sourceCurrency,
		targetCurrency,
		targetCurrency,
		sourceCurrency,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
		sourceCurrency,
		targetCurrency,
	).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.BaseCurrency == "" || record.TargetCurrency == "" || record.Rate == "" {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func (r *Repository) UpsertRate(ctx context.Context, baseCurrency string, targetCurrency string, rate string, rateDate time.Time) error {
	return r.db.WithContext(ctx).Exec(`
        INSERT INTO exchange_rates (base_currency, target_currency, rate, rate_date)
        VALUES (?, ?, CAST(? AS numeric(12,6)), ?)
        ON CONFLICT (base_currency, target_currency, rate_date)
        DO UPDATE SET rate = EXCLUDED.rate
    `, baseCurrency, targetCurrency, rate, rateDate.Format("2006-01-02")).Error
}

func isNotFound(err error) bool { return errors.Is(err, gorm.ErrRecordNotFound) }
func wrapRepoError(message string, err error) *AppError {
	return internalError(fmt.Sprintf("%s: %v", message, err))
}
