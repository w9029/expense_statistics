package invitation

import (
	"time"

	"github.com/google/uuid"
)

type InvitationRecord struct {
	ID              uuid.UUID
	AccountBookID   uuid.UUID
	AccountBookName string
	InviterUserID   uuid.UUID
	InviterName     string
	AccountRole     string
	Token           string
	Status          string
	MaxUsage        int
	UsedCount       int
	ExpiresAt       time.Time
	CreatedAt       time.Time
}
