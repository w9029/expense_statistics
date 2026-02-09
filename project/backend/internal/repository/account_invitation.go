package repository

import (
    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/model"
    "github.com/google/uuid"

    "gorm.io/gorm"
)

type AccountInvitationRepository struct {
    db *gorm.DB
}

func NewAccountInvitationRepository() *AccountInvitationRepository {
    return &AccountInvitationRepository{
        db: config.DB,
    }
}

func (r *AccountInvitationRepository) Create(invitation *model.AccountInvitation) error {
    return r.db.Create(invitation).Error
}

func (r *AccountInvitationRepository) GetByToken(token string) (*model.AccountInvitation, error) {
	var invitation model.AccountInvitation
	if err := r.db.Where("token = ?", token).First(&invitation).Error; err != nil {
		return nil, err
	}
	return &invitation, nil
}

func (r *AccountInvitationRepository) Update(invitation *model.AccountInvitation) error {
	return r.db.Save(invitation).Error
}

func (r *AccountInvitationRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.AccountInvitation{}, "id = ?", id).Error
}

