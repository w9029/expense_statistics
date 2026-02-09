package repository

import (
    "time"
    "github.com/google/uuid"

    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/model"
    "gorm.io/gorm"
)


type ExpenseRepository struct {
    db *gorm.DB
}

func NewExpenseRepository() *ExpenseRepository {
    return &ExpenseRepository{
        db: config.DB,
    }
}

func (r *ExpenseRepository) Create(expense *model.Expense) error {
    return r.db.Create(expense).Error
}

func (r *ExpenseRepository) GetByAccountIdByPage(accountID uuid.UUID, offset int, limit int) ([]*model.Expense, int64, error) {
    var expenses []*model.Expense
    var total int64

    if err := r.db.Model(&model.Expense{}).
        Where("account_book_id = ? AND deleted_at IS NULL", accountID).
        Count(&total).Error; err != nil {
        return nil, 0, err
    }

    if err := r.db.
        Where("account_book_id = ? AND deleted_at IS NULL", accountID).
        Offset(offset).
        Limit(limit).
        Find(&expenses).Error; err != nil {
        return nil, 0, err
    }
    return expenses, total, nil
}

func (r *ExpenseRepository) GetByCategoryIdByPage(category_id uuid.UUID, offset int, limit int) ([]*model.Expense, int64, error) {
    var expenses []*model.Expense
    var total int64

    if err := r.db.Model(&model.Expense{}).
        Where("category_id = ? AND deleted_at IS NULL", category_id).
        Count(&total).Error; err != nil {
        return nil, 0, err
    }

    if err := r.db.
        Where("category_id = ? AND deleted_at IS NULL", category_id).
        Offset(offset).
        Limit(limit).
        Find(&expenses).Error; err != nil {
        return nil, 0, err
    }
    return expenses, total, nil
}

func (r *ExpenseRepository) GetByParentId(parent_id uuid.UUID) ([]*model.Expense, error) {
    var expenses []*model.Expense

	err := r.db.Where("parent_id = ? AND deleted_at IS NULL", parent_id).Find(&expenses).Error; 
    if err != nil {
        return nil, err
    }
    return expenses, nil
}

func (r *ExpenseRepository) Update(expense *model.Expense) error {

    return r.db.Save(expense).Error
}

func (r *ExpenseRepository) Delete(id uuid.UUID) error {
    now := time.Now()
    return r.db.Model(&model.Expense{}).
        Where("id = ?", id).
        Update("deleted_at", &now).Error
}


