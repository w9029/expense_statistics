package repository

import (
	
    "github.com/google/uuid"
    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/model"
	"gorm.io/gorm"
)

type AccountbookUserPermissionRepository struct {
    db *gorm.DB
}

func NewAccountbookUserPermissionRepository() *AccountbookUserPermissionRepository {
    return &AccountbookUserPermissionRepository{
        db: config.DB,
    }
}

func (r *AccountbookUserPermissionRepository) Create(perm *model.AccountbookUserPermission) error {
    return r.db.Create(perm).Error
}

func (r *AccountbookUserPermissionRepository) GetByAccountBookID(accountBookID uuid.UUID) ([]*model.AccountbookUserPermission, error) {
    var list []*model.AccountbookUserPermission
    if err := r.db.Where("account_book_id = ?", accountBookID).Find(&list).Error; err != nil {
        return nil, err
    }
    return list, nil
}

func (r *AccountbookUserPermissionRepository) GetByUserID(userID uuid.UUID) ([]*model.AccountbookUserPermission, error) {
    var list []*model.AccountbookUserPermission
    if err := r.db.Where("user_id = ?", userID).Find(&list).Error; err != nil {
        return nil, err
    }
    return list, nil
}

func (r *AccountbookUserPermissionRepository) GetByUserAndAccountBook(userID, accountBookID uuid.UUID) (*model.AccountbookUserPermission, error) {
    var perm model.AccountbookUserPermission
    if err := r.db.Where("user_id = ? AND account_book_id = ?", userID, accountBookID).First(&perm).Error; err != nil {
        return nil, err
    }
    return &perm, nil
}

func (r *AccountbookUserPermissionRepository) Update(perm *model.AccountbookUserPermission) error {
	return r.db.Save(perm).Error
}

func (r *AccountbookUserPermissionRepository) Delete(userID, accountBookID uuid.UUID) error {
	return r.db.Delete(&model.AccountbookUserPermission{}, "user_id = ? AND account_book_id = ?", userID, accountBookID).Error
}

