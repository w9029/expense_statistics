package repository

import (
    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/model"
    "github.com/google/uuid"

    "gorm.io/gorm"
)

type AuthRefreshTokenRepository struct {
    db *gorm.DB
}

func NewAuthRefreshTokenRepository() *AuthRefreshTokenRepository {
    return &AuthRefreshTokenRepository{
        db: config.DB,
    }
}

func (r *AuthRefreshTokenRepository) Create(token *model.AuthRefreshToken) error {
    return r.db.Create(token).Error
}

func (r *AuthRefreshTokenRepository) GetByRefreshToken(refreshToken string) (*model.AuthRefreshToken, error) {
	var token model.AuthRefreshToken
	if err := r.db.Where("refresh_token = ?", refreshToken).First(&token).Error; err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *AuthRefreshTokenRepository) Update(token *model.AuthRefreshToken) error {
	return r.db.Save(token).Error
}

func (r *AuthRefreshTokenRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.AuthRefreshToken{}, "id = ?", id).Error
}

