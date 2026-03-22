package accountbook

import (
	"time"

	"github.com/google/uuid"
)

type AccountBookRecord struct {
	ID                   uuid.UUID
	Name                 string
	OwnerUserID          uuid.UUID
	BaseCurrency         string
	Description          *string
	IsActive             bool
	CreatedAt            time.Time
	UpdatedAt            time.Time
	DefaultAccountBookID *uuid.UUID
	MyRole               string
}

type AccountBookMemberRecord struct {
	UserID      uuid.UUID
	Name        string
	Email       string
	AccountRole string
	JoinedAt    time.Time
}
