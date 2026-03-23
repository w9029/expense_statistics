package identity

import (
	"time"

	"github.com/google/uuid"
)

// These records are local to the identity module.
// Other modules should define their own read/write shapes instead of depending on them.
type UserRecord struct {
	ID                   uuid.UUID
	Email                string
	PasswordHash         string
	Name                 string
	PreferredCurrency    string
	UserRole             string
	DefaultAccountBookID *uuid.UUID
	AvatarPath           *string
	IsActive             bool
}

type VerificationRecord struct {
	ID        uuid.UUID
	Email     string
	Code      string
	Purpose   string
	Token     *string
	Verified  bool
	ExpiresAt time.Time
}

type RefreshTokenRecord struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	RefreshToken string
	ExpiresAt    time.Time
	RevokedAt    *time.Time
}
