package invitation

import (
	"time"

	"github.com/google/uuid"
)

type CreateInvitationRequest struct {
	AccountBookID  uuid.UUID `json:"account_book_id" binding:"required"`
	AccountRole    string    `json:"account_role" binding:"required"`
	MaxUsage       int       `json:"max_usage" binding:"omitempty,min=1,max=100"`
	ExpiresInHours int       `json:"expires_in_hours" binding:"omitempty,min=1,max=720"`
}

type InvitationResponse struct {
	ID              uuid.UUID `json:"id"`
	AccountBookID   uuid.UUID `json:"account_book_id"`
	AccountBookName string    `json:"account_book_name"`
	InviterUserID   uuid.UUID `json:"inviter_user_id"`
	InviterName     string    `json:"inviter_name"`
	AccountRole     string    `json:"account_role"`
	Token           string    `json:"token"`
	Status          string    `json:"status"`
	MaxUsage        int       `json:"max_usage"`
	UsedCount       int       `json:"used_count"`
	ExpiresAt       time.Time `json:"expires_at"`
	CreatedAt       time.Time `json:"created_at"`
	InviteURL       string    `json:"invite_url"`
}

type InvitationDetailResponse struct {
	AccountBookID   uuid.UUID `json:"account_book_id"`
	AccountBookName string    `json:"account_book_name"`
	InviterName     string    `json:"inviter_name"`
	AccountRole     string    `json:"account_role"`
	Status          string    `json:"status"`
	MaxUsage        int       `json:"max_usage"`
	UsedCount       int       `json:"used_count"`
	ExpiresAt       time.Time `json:"expires_at"`
	Acceptable      bool      `json:"acceptable"`
}

type AcceptInvitationResponse struct {
	AccountBookID uuid.UUID `json:"account_book_id"`
	AccountRole   string    `json:"account_role"`
	Joined        bool      `json:"joined"`
}
