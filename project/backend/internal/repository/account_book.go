package repository

import (
    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/model"
    "time"
    "github.com/google/uuid"

    "gorm.io/gorm"
)

type AccountBookRepository struct {
    db *gorm.DB
}

func NewAccountBookRepository() *AccountBookRepository {
    return &AccountBookRepository{
        db: config.DB,
    }
}

func (r *AccountBookRepository) Create(ab *model.AccountBook) error {
    return r.db.Create(ab).Error
}

func (r *AccountBookRepository) GetByID(id uuid.UUID) (*model.AccountBook, error) {
    var ab model.AccountBook
	err := r.db.Where("id = ? AND deleted_at IS NULL", id).First(&ab).Error;
    if err != nil {
        return nil, err
    }
    return &ab, nil
}

func (r *AccountBookRepository) GetByOwner(ownerID uuid.UUID) ([]*model.AccountBook, error) {
    var list []*model.AccountBook
	err := r.db.Where("owner_user_id = ? AND deleted_at IS NULL", ownerID).Find(&list).Error; 
    if err != nil {
        return nil, err
    }
    return list, nil
}

func (r *AccountBookRepository) Update(ab *model.AccountBook) error {
    return r.db.Save(ab).Error
}

func (r *AccountBookRepository) Delete(id uuid.UUID) error {
    return r.db.Model(&model.AccountBook{}).
        Where("id = ?", id).
        Update("deleted_at", time.Now()).Error
}

func (r *AccountBookRepository) ListByPage(offset int, limit int) ([]*model.AccountBook, int64, error) {
    var accountBooks []*model.AccountBook
    var total int64

    if err := r.db.Model(&model.AccountBook{}).
        Where("deleted_at IS NULL").
        Count(&total).Error; err != nil {
        return nil, 0, err
    }

    if err := r.db.
        Where("deleted_at IS NULL").
        Offset(offset).
        Limit(limit).
        Find(&accountBooks).Error; err != nil {
        return nil, 0, err
    }

    return accountBooks, total, nil
}
