package repository

import (
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

func (r *UserRepository) GetByID(id string) (*model.User, error) {
    var user model.User
    if err := r.db.First(&user, "id = ?", id).Error; err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *UserRepository) GetByEmail(email string) (*model.User, error) {
    var user model.User
    if err := r.db.First(&user, "email = ?", email).Error; err != nil {
        return nil, err
    }
    return &user, nil
}
