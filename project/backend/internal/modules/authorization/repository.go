package authorization

import (
	"context"
	"errors"
	"fmt"

	"expense-statistics-server/internal/platform/db"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct{ db *gorm.DB }

func NewRepository(database *db.Database) *Repository { return &Repository{db: database.Gorm} }

func (r *Repository) GetAccountBookPermission(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) (*AccountBookPermissionRecord, error) {
	var record AccountBookPermissionRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT p.account_book_id, p.user_id, p.account_role
        FROM accountbook_user_permissions p
        INNER JOIN account_books ab ON ab.id = p.account_book_id
        WHERE p.user_id = ? AND p.account_book_id = ? AND ab.deleted_at IS NULL
        LIMIT 1
    `, userID, accountBookID).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.AccountBookID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func isNotFound(err error) bool { return errors.Is(err, gorm.ErrRecordNotFound) }
func wrapRepoError(message string, err error) *AppError {
	return internalError(fmt.Sprintf("%s: %v", message, err))
}
