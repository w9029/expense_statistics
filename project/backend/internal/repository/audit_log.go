package repository

import (
    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/model"
    "github.com/google/uuid"

    "gorm.io/gorm"
)

type AuditLogRepository struct {
    db *gorm.DB
}

func NewAuditLogRepository() *AuditLogRepository {
    return &AuditLogRepository{
        db: config.DB,
    }
}

func (r *AuditLogRepository) Create(log *model.AuditLog) error {
    return r.db.Create(log).Error
}

func (r *AuditLogRepository) GetByUserIdByPage(userID uuid.UUID, offset int, limit int) ([]*model.AuditLog, int64, error) {
	var list []*model.AuditLog
	var total int64

	err := r.db.Model(&model.AuditLog{}).
		Where("user_id = ?", userID).
		Count(&total).Error; 
	if err != nil {
		return nil, 0, err
	}

	err = r.db.Where("user_id = ?", userID).
		Offset(offset).
		Limit(limit).
		Find(&list).Error; 

	if err != nil {
		return nil, 0, err
	}

	return list, total, nil
}

func (r *AuditLogRepository) GetByTargetIdByPage(targetID uuid.UUID, offset int, limit int) ([]*model.AuditLog, int64, error) {
	var list []*model.AuditLog
	var total int64

	err := r.db.Model(&model.AuditLog{}).
		Where("target_id = ?", targetID).
		Count(&total).Error; 
	if err != nil {
		return nil, 0, err
	}

	err = r.db.Where("target_id = ?", targetID).
		Offset(offset).
		Limit(limit).
		Find(&list).Error; 

	if err != nil {
		return nil, 0, err
	}

	return list, total, nil
}

func (r *AuditLogRepository) Update(log *model.AuditLog) error {
	return r.db.Save(log).Error
}

func (r *AuditLogRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.AuditLog{}, "id = ?", id).Error
}

func (r *AuditLogRepository) ListByPage(offset int, limit int) ([]*model.AuditLog, int64, error) {
    var logs []*model.AuditLog
    var total int64

	err := r.db.Model(&model.AuditLog{}).
        Count(&total).Error; 
		
    if err != nil {
        return nil, 0, err
    }

	err = r.db.Model(&model.AuditLog{}).
        Offset(offset).
        Limit(limit).
        Find(&logs).Error; 

    if err != nil {
        return nil, 0, err
    }

    return logs, total, nil
}
