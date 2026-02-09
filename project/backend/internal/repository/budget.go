package repository

import (
    "github.com/google/uuid"

    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/model"
    "gorm.io/gorm"
)


type BudgetRepository struct {
    db *gorm.DB
}

func NewBudgetRepository() *BudgetRepository {
    return &BudgetRepository{
        db: config.DB,
    }
}

func (r *BudgetRepository) Create(budget *model.Budget) error {
    return r.db.Create(budget).Error
}

func (r *BudgetRepository) GetByAccountBookID(accountBookID uuid.UUID) (*[]model.Budget, error) {
    var budgets []model.Budget
    err := r.db.Find(&budgets, "account_book_id = ?", accountBookID).Error; 
    if err != nil {
        return nil, err
    }
    return &budgets, nil
}

func (r *BudgetRepository) Update(budget *model.Budget) error {

    return r.db.Save(budget).Error
}

func (r *BudgetRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.Budget{}, "id = ?", id).Error
}

