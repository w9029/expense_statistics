package identity

import (
	"context"
	"errors"
	"fmt"
	"time"

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

func (r *Repository) DeleteVerificationsByEmailPurpose(ctx context.Context, email string, purpose string) error {
	return r.db.WithContext(ctx).Exec("DELETE FROM email_verification WHERE email = ? AND purpose = ?", email, purpose).Error
}
func (r *Repository) CreateVerification(ctx context.Context, record VerificationRecord) error {
	return r.db.WithContext(ctx).Exec(`INSERT INTO email_verification (email, code, purpose, token, verified, expires_at) VALUES (?, ?, ?, ?, ?, ?)`, record.Email, record.Code, record.Purpose, record.Token, record.Verified, record.ExpiresAt).Error
}
func (r *Repository) GetPendingVerificationByCode(ctx context.Context, email string, purpose string, code string) (*VerificationRecord, error) {
	var record VerificationRecord
	err := r.db.WithContext(ctx).Raw(`SELECT id, email, code, purpose, token, verified, expires_at FROM email_verification WHERE email = ? AND purpose = ? AND code = ? AND verified = false AND expires_at > now() LIMIT 1`, email, purpose, code).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}
func (r *Repository) MarkVerificationVerified(ctx context.Context, id uuid.UUID, expiresAt time.Time) error {
	return r.db.WithContext(ctx).Exec(`UPDATE email_verification SET verified = true, expires_at = ? WHERE id = ?`, expiresAt, id).Error
}
func (r *Repository) GetVerifiedVerificationByToken(ctx context.Context, email string, purpose string, token string) (*VerificationRecord, error) {
	var record VerificationRecord
	err := r.db.WithContext(ctx).Raw(`SELECT id, email, code, purpose, token, verified, expires_at FROM email_verification WHERE email = ? AND purpose = ? AND token = ? AND verified = true AND expires_at > now() LIMIT 1`, email, purpose, token).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}
func (r *Repository) DeleteVerificationByID(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Exec("DELETE FROM email_verification WHERE id = ?", id).Error
}
func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*UserRecord, error) {
	var record UserRecord
	err := r.db.WithContext(ctx).Raw(`SELECT id, email, password_hash, name, preferred_currency, user_role, default_account_book_id, avatar_path, is_active FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`, email).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}
func (r *Repository) CreateUser(ctx context.Context, email string, passwordHash string, name string, preferredCurrency string) (*UserRecord, error) {
	var record UserRecord
	err := r.db.WithContext(ctx).Raw(`INSERT INTO users (email, password_hash, name, preferred_currency) VALUES (?, ?, ?, ?) RETURNING id, email, password_hash, name, preferred_currency, user_role, default_account_book_id, avatar_path, is_active`, email, passwordHash, name, preferredCurrency).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}
func (r *Repository) CreateRefreshToken(ctx context.Context, userID uuid.UUID, refreshToken string, expiresAt time.Time) error {
	return r.db.WithContext(ctx).Exec(`INSERT INTO auth_refresh_tokens (user_id, refresh_token, expires_at) VALUES (?, ?, ?)`, userID, refreshToken, expiresAt).Error
}
func (r *Repository) GetActiveRefreshToken(ctx context.Context, refreshToken string) (*RefreshTokenRecord, error) {
	var record RefreshTokenRecord
	err := r.db.WithContext(ctx).Raw(`SELECT id, user_id, refresh_token, expires_at, revoked_at FROM auth_refresh_tokens WHERE refresh_token = ? AND revoked_at IS NULL AND expires_at > now() LIMIT 1`, refreshToken).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}
func (r *Repository) RevokeRefreshToken(ctx context.Context, id uuid.UUID, revokedAt time.Time) error {
	return r.db.WithContext(ctx).Exec(`UPDATE auth_refresh_tokens SET revoked_at = ? WHERE id = ?`, revokedAt, id).Error
}
func (r *Repository) MustGetUserByID(ctx context.Context, id uuid.UUID) (*UserRecord, error) {
	var record UserRecord
	err := r.db.WithContext(ctx).Raw(`SELECT id, email, password_hash, name, preferred_currency, user_role, default_account_book_id, avatar_path, is_active FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`, id).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func (r *Repository) UpdateUserProfile(ctx context.Context, userID uuid.UUID, name string, preferredCurrency string, avatarPath *string) (*UserRecord, error) {
	var record UserRecord
	err := r.db.WithContext(ctx).Raw(`
        UPDATE users
        SET name = ?,
            preferred_currency = ?,
            avatar_path = ?,
            updated_at = now()
        WHERE id = ? AND deleted_at IS NULL
        RETURNING id, email, password_hash, name, preferred_currency, user_role, default_account_book_id, avatar_path, is_active
    `, name, preferredCurrency, avatarPath, userID).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func (r *Repository) UpdateDefaultAccountBook(ctx context.Context, userID uuid.UUID, accountBookID *uuid.UUID) (*UserRecord, error) {
	var record UserRecord
	err := r.db.WithContext(ctx).Raw(`
        UPDATE users
        SET default_account_book_id = ?,
            updated_at = now()
        WHERE id = ? AND deleted_at IS NULL
        RETURNING id, email, password_hash, name, preferred_currency, user_role, default_account_book_id, avatar_path, is_active
    `, accountBookID, userID).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func (r *Repository) UserHasAccountBookAccess(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Raw(`
        SELECT COUNT(*)
        FROM accountbook_user_permissions p
        INNER JOIN account_books ab ON ab.id = p.account_book_id
        WHERE p.user_id = ? AND p.account_book_id = ? AND ab.deleted_at IS NULL
    `, userID, accountBookID).Scan(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func isNotFound(err error) bool { return errors.Is(err, gorm.ErrRecordNotFound) }
func wrapRepoError(message string, err error) *AppError {
	return internalError(fmt.Sprintf("%s: %v", message, err))
}
