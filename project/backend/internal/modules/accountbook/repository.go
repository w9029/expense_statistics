package accountbook

import (
	"context"
	"fmt"

	"expense-statistics-server/internal/platform/db"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct{ db *gorm.DB }

func NewRepository(database *db.Database) *Repository { return &Repository{db: database.Gorm} }
func (r *Repository) WithTx(tx *gorm.DB) *Repository  { return &Repository{db: tx} }
func (r *Repository) Transaction(ctx context.Context, fn func(repo *Repository) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error { return fn(r.WithTx(tx)) })
}

func (r *Repository) CreateAccountBook(ctx context.Context, ownerUserID uuid.UUID, name string, baseCurrency string, description *string) (*AccountBookRecord, error) {
	var record AccountBookRecord
	err := r.db.WithContext(ctx).Raw(`
        INSERT INTO account_books (name, owner_user_id, base_currency, description)
        VALUES (?, ?, ?, ?)
        RETURNING id, name, owner_user_id, base_currency, description, is_active, created_at, updated_at
    `, name, ownerUserID, baseCurrency, description).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *Repository) AddPermission(ctx context.Context, accountBookID uuid.UUID, userID uuid.UUID, role string) error {
	return r.db.WithContext(ctx).Exec(`INSERT INTO accountbook_user_permissions (account_book_id, user_id, account_role) VALUES (?, ?, ?)`, accountBookID, userID, role).Error
}

func (r *Repository) SetDefaultAccountBookIfNull(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) error {
	return r.db.WithContext(ctx).Exec(`UPDATE users SET default_account_book_id = ? WHERE id = ? AND default_account_book_id IS NULL`, accountBookID, userID).Error
}

func (r *Repository) ListAccessible(ctx context.Context, userID uuid.UUID) ([]AccountBookRecord, error) {
	var records []AccountBookRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT ab.id, ab.name, ab.owner_user_id, ab.base_currency, ab.description, ab.is_active, ab.created_at, ab.updated_at,
               u.default_account_book_id, p.account_role AS my_role
        FROM accountbook_user_permissions p
        INNER JOIN account_books ab ON ab.id = p.account_book_id
        INNER JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ? AND ab.deleted_at IS NULL
        ORDER BY ab.created_at DESC
    `, userID).Scan(&records).Error
	return records, err
}

func (r *Repository) GetAccessibleByID(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) (*AccountBookRecord, error) {
	var record AccountBookRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT ab.id, ab.name, ab.owner_user_id, ab.base_currency, ab.description, ab.is_active, ab.created_at, ab.updated_at,
               u.default_account_book_id, p.account_role AS my_role
        FROM accountbook_user_permissions p
        INNER JOIN account_books ab ON ab.id = p.account_book_id
        INNER JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ? AND p.account_book_id = ? AND ab.deleted_at IS NULL
        LIMIT 1
    `, userID, accountBookID).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func wrapRepoError(message string, err error) *AppError {
	return internalError(fmt.Sprintf("%s: %v", message, err))
}
