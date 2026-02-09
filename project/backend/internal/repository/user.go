package repository

import (
    "time"
    "github.com/google/uuid"

    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/model"
    "gorm.io/gorm"
)


type UserRepository struct {
    db *gorm.DB
}

func NewUserRepository() *UserRepository {
    return &UserRepository{
        db: config.DB,
    }
}

func (r *UserRepository) Create(user *model.User) error {
    return r.db.Create(user).Error
}

func (r *UserRepository) GetByID(id uuid.UUID) (*model.User, error) {
    var user model.User
    err := r.db.First(&user, "id = ? AND deleted_at IS NULL", id).Error; 
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *UserRepository) GetByEmail(email string) (*model.User, error) {
    var user model.User
    err := r.db.Where("email = ? AND deleted_at IS NULL", email).First(&user).Error
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *UserRepository) Update(user *model.User) error {

    return r.db.Save(user).Error
}

func (r *UserRepository) Delete(id uuid.UUID) error {
    now := time.Now()
    return r.db.Model(&model.User{}).
        Where("id = ?", id).
        Update("deleted_at", &now).Error
}

func (r *UserRepository) ListByPage(offset int, limit int) ([]*model.User, int64, error) {
    var users []*model.User
    var total int64

    if err := r.db.Model(&model.User{}).
        Where("deleted_at IS NULL").
        Count(&total).Error; err != nil {
        return nil, 0, err
    }

    if err := r.db.
        Where("deleted_at IS NULL").
        Offset(offset).
        Limit(limit).
        Find(&users).Error; err != nil {
        return nil, 0, err
    }

    return users, total, nil
}

