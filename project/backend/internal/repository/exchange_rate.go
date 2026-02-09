package repository

import (
	
    "github.com/google/uuid"
	"time"
    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/model"
	"gorm.io/gorm"
)

type ExchangeRateRepository struct {
    db *gorm.DB
}

func NewExchangeRateRepository() *ExchangeRateRepository {
    return &ExchangeRateRepository{
        db: config.DB,
    }
}

func (r *ExchangeRateRepository) Create(rate *model.ExchangeRate) error {
    return r.db.Create(rate).Error
}

func (r *ExchangeRateRepository) GetExchangeRate(baseCurrency, targetCurrency string, date time.Time) (*model.ExchangeRate, error) {
    var rate model.ExchangeRate
    if err := r.db.Where("base_currency = ? AND target_currency = ? AND date = ?", baseCurrency, targetCurrency, date).First(&rate).Error; err != nil {
        return nil, err
    }
    return &rate, nil
}

func (r *ExchangeRateRepository) Update(rate *model.ExchangeRate) error {
	return r.db.Save(rate).Error
}

func (r *ExchangeRateRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.ExchangeRate{}, "id = ?", id).Error
}

