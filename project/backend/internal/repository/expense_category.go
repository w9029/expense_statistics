package repository

import (
    "time"
    "github.com/google/uuid"

    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/model"
    "gorm.io/gorm"
)


type ExpenseCategoryRepository struct {
    db *gorm.DB
}

func NewExpenseCategoryRepository() *ExpenseCategoryRepository {
    return &ExpenseCategoryRepository{
        db: config.DB,
    }
}

func (r *ExpenseCategoryRepository) Create(category *model.ExpenseCategory) error {
    return r.db.Create(category).Error
}

func (r *ExpenseCategoryRepository) GetByAccountBookID(accountBookID uuid.UUID) (*[]model.ExpenseCategory, error) {
    var categories []model.ExpenseCategory
    err := r.db.Where("account_book_id = ? AND deleted_at IS NULL", accountBookID).Find(&categories).Error; 
    if err != nil {
        return nil, err
    }
    return &categories, nil
}

func (r *ExpenseCategoryRepository) Update(category *model.ExpenseCategory) error {

    return r.db.Save(category).Error
}

func (r *ExpenseCategoryRepository) Delete(id uuid.UUID) error {
    now := time.Now()
    return r.db.Model(&model.ExpenseCategory{}).
        Where("id = ?", id).
        Update("deleted_at", &now).Error
}
