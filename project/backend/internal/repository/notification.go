package repository

import (
    "github.com/google/uuid"

    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/model"
    "gorm.io/gorm"
)


type NotificationRepository struct {
    db *gorm.DB
}

func NewNotificationRepository() *NotificationRepository {
    return &NotificationRepository{
        db: config.DB,
    }
}

func (r *NotificationRepository) Create(notification *model.Notification) error {
    return r.db.Create(notification).Error
}

func (r *NotificationRepository) GetByUserIdByPage(userId uuid.UUID, offset int, limit int) (*[]model.Notification, int64, error) {
    var notifications []model.Notification
    var total int64

    if err := r.db.Model(&model.Notification{}).
        Where("user_id = ?", userId).
        Count(&total).Error; err != nil {
        return nil, 0, err
    }

    if err := r.db.
        Where("user_id = ?", userId).
        Offset(offset).
        Limit(limit).
        Find(&notifications).Error; err != nil {
        return nil, 0, err
    }

    return &notifications, total, nil
}

func (r *NotificationRepository) Update(notification *model.Notification) error {
    return r.db.Save(notification).Error
}

func (r *NotificationRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.Notification{}, "id = ?", id).Error
}
