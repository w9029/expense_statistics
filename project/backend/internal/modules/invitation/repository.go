package invitation

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

func (r *Repository) CreateInvitation(ctx context.Context, accountBookID uuid.UUID, inviterUserID uuid.UUID, accountRole string, token string, maxUsage int, expiresAt time.Time) (*InvitationRecord, error) {
	var record InvitationRecord
	err := r.db.WithContext(ctx).Raw(`
        INSERT INTO account_invitations (account_book_id, inviter_user_id, account_role, token, expires_at, max_usage, used_count, status)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'active')
        RETURNING id, account_book_id, inviter_user_id, account_role, token, status, max_usage, used_count, expires_at, created_at
    `, accountBookID, inviterUserID, accountRole, token, expiresAt, maxUsage).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	return r.GetInvitationByToken(ctx, token)
}

func (r *Repository) GetInvitationByToken(ctx context.Context, token string) (*InvitationRecord, error) {
	var record InvitationRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT ai.id, ai.account_book_id, ab.name AS account_book_name, ai.inviter_user_id, u.name AS inviter_name,
               ai.account_role, ai.token, ai.status, ai.max_usage, ai.used_count, ai.expires_at, ai.created_at
        FROM account_invitations ai
        INNER JOIN account_books ab ON ab.id = ai.account_book_id
        INNER JOIN users u ON u.id = ai.inviter_user_id
        WHERE ai.token = ? AND ab.deleted_at IS NULL
        LIMIT 1
    `, token).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func (r *Repository) GetInvitationByID(ctx context.Context, invitationID uuid.UUID) (*InvitationRecord, error) {
	var record InvitationRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT ai.id, ai.account_book_id, ab.name AS account_book_name, ai.inviter_user_id, u.name AS inviter_name,
               ai.account_role, ai.token, ai.status, ai.max_usage, ai.used_count, ai.expires_at, ai.created_at
        FROM account_invitations ai
        INNER JOIN account_books ab ON ab.id = ai.account_book_id
        INNER JOIN users u ON u.id = ai.inviter_user_id
        WHERE ai.id = ? AND ab.deleted_at IS NULL
        LIMIT 1
    `, invitationID).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func (r *Repository) ListInvitationsByAccountBookID(ctx context.Context, accountBookID uuid.UUID) ([]InvitationRecord, error) {
	var records []InvitationRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT ai.id, ai.account_book_id, ab.name AS account_book_name, ai.inviter_user_id, u.name AS inviter_name,
               ai.account_role, ai.token, ai.status, ai.max_usage, ai.used_count, ai.expires_at, ai.created_at
        FROM account_invitations ai
        INNER JOIN account_books ab ON ab.id = ai.account_book_id
        INNER JOIN users u ON u.id = ai.inviter_user_id
        WHERE ai.account_book_id = ? AND ab.deleted_at IS NULL
        ORDER BY ai.created_at DESC, ai.id DESC
    `, accountBookID).Scan(&records).Error
	if err != nil {
		return nil, err
	}
	return records, nil
}

func (r *Repository) GetInvitationByTokenForUpdate(ctx context.Context, token string) (*InvitationRecord, error) {
	var record InvitationRecord
	err := r.db.WithContext(ctx).Raw(`
        SELECT ai.id, ai.account_book_id, ab.name AS account_book_name, ai.inviter_user_id, u.name AS inviter_name,
               ai.account_role, ai.token, ai.status, ai.max_usage, ai.used_count, ai.expires_at, ai.created_at
        FROM account_invitations ai
        INNER JOIN account_books ab ON ab.id = ai.account_book_id
        INNER JOIN users u ON u.id = ai.inviter_user_id
        WHERE ai.token = ? AND ab.deleted_at IS NULL
        FOR UPDATE
    `, token).Scan(&record).Error
	if err != nil {
		return nil, err
	}
	if record.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &record, nil
}

func (r *Repository) IncrementInvitationUsage(ctx context.Context, invitationID uuid.UUID) error {
	return r.db.WithContext(ctx).Exec(`UPDATE account_invitations SET used_count = used_count + 1 WHERE id = ?`, invitationID).Error
}

func (r *Repository) RevokeInvitation(ctx context.Context, invitationID uuid.UUID) error {
	return r.db.WithContext(ctx).Exec(`UPDATE account_invitations SET status = 'revoked' WHERE id = ?`, invitationID).Error
}

func (r *Repository) GetPermission(ctx context.Context, accountBookID uuid.UUID, userID uuid.UUID) (string, error) {
	var role string
	err := r.db.WithContext(ctx).Raw(`SELECT account_role FROM accountbook_user_permissions WHERE account_book_id = ? AND user_id = ? LIMIT 1`, accountBookID, userID).Scan(&role).Error
	if err != nil {
		return "", err
	}
	if role == "" {
		return "", gorm.ErrRecordNotFound
	}
	return role, nil
}

func (r *Repository) AddPermission(ctx context.Context, accountBookID uuid.UUID, userID uuid.UUID, role string) error {
	return r.db.WithContext(ctx).Exec(`INSERT INTO accountbook_user_permissions (account_book_id, user_id, account_role) VALUES (?, ?, ?)`, accountBookID, userID, role).Error
}

func (r *Repository) SetDefaultAccountBookIfNull(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) error {
	return r.db.WithContext(ctx).Exec(`UPDATE users SET default_account_book_id = ? WHERE id = ? AND default_account_book_id IS NULL`, accountBookID, userID).Error
}

func isNotFound(err error) bool { return errors.Is(err, gorm.ErrRecordNotFound) }
func wrapRepoError(message string, err error) *AppError {
	return internalError(fmt.Sprintf("%s: %v", message, err))
}
