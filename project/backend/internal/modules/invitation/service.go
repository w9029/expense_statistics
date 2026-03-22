package invitation

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"expense-statistics-server/internal/modules/authorization"

	"github.com/google/uuid"
)

type Service struct {
	repo          *Repository
	authorization *authorization.Service
}

func NewService(repo *Repository, authorizationService *authorization.Service) *Service {
	return &Service{repo: repo, authorization: authorizationService}
}

func (s *Service) ListByAccountBook(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) ([]InvitationResponse, error) {
	role, err := s.authorization.GetAccountBookRole(ctx, userID, accountBookID)
	if err != nil {
		if appErr, ok := err.(*authorization.AppError); ok {
			return nil, &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
		}
		return nil, internalError(err.Error())
	}
	if !authorization.CanAccessRole(role, "admin") {
		return nil, forbidden("you cannot view invitations for this account book")
	}

	records, err := s.repo.ListInvitationsByAccountBookID(ctx, accountBookID)
	if err != nil {
		return nil, wrapRepoError("list invitations by account book", err)
	}

	result := make([]InvitationResponse, 0, len(records))
	for _, record := range records {
		result = append(result, *toInvitationResponse(&record))
	}
	return result, nil
}

func (s *Service) DeleteByAccountBook(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, invitationID uuid.UUID) (*DeleteInvitationResponse, error) {
	role, err := s.authorization.GetAccountBookRole(ctx, userID, accountBookID)
	if err != nil {
		if appErr, ok := err.(*authorization.AppError); ok {
			return nil, &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
		}
		return nil, internalError(err.Error())
	}
	if !authorization.CanAccessRole(role, "admin") {
		return nil, forbidden("you cannot delete invitations for this account book")
	}

	invitation, err := s.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("invitation not found")
		}
		return nil, wrapRepoError("get invitation by id", err)
	}
	if invitation.AccountBookID != accountBookID {
		return nil, notFound("invitation not found")
	}
	if err := s.repo.DeleteInvitation(ctx, invitationID); err != nil {
		if isNotFound(err) {
			return nil, notFound("invitation not found")
		}
		return nil, wrapRepoError("delete invitation", err)
	}
	return &DeleteInvitationResponse{InvitationID: invitationID, Deleted: true}, nil
}

func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreateInvitationRequest) (*InvitationResponse, error) {
	role, err := s.authorization.GetAccountBookRole(ctx, userID, req.AccountBookID)
	if err != nil {
		if appErr, ok := err.(*authorization.AppError); ok {
			return nil, &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
		}
		return nil, internalError(err.Error())
	}
	if !authorization.CanAccessRole(role, "admin") {
		return nil, forbidden("you cannot create invitations for this account book")
	}
	if !isInvitationRole(req.AccountRole) {
		return nil, invalidRequest("account_role must be viewer, editor, or admin")
	}

	maxUsage := req.MaxUsage
	if maxUsage <= 0 {
		maxUsage = 1
	}
	expiresInHours := req.ExpiresInHours
	if expiresInHours <= 0 {
		expiresInHours = 72
	}

	token, err := generateToken(24)
	if err != nil {
		return nil, internalError("generate invitation token failed")
	}

	record, err := s.repo.CreateInvitation(ctx, req.AccountBookID, userID, req.AccountRole, token, maxUsage, time.Now().Add(time.Duration(expiresInHours)*time.Hour))
	if err != nil {
		return nil, wrapRepoError("create invitation", err)
	}
	return toInvitationResponse(record), nil
}

func (s *Service) GetByToken(ctx context.Context, token string) (*InvitationDetailResponse, error) {
	record, err := s.repo.GetInvitationByToken(ctx, strings.TrimSpace(token))
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("invitation not found")
		}
		return nil, wrapRepoError("get invitation by token", err)
	}
	return toInvitationDetailResponse(record), nil
}

func (s *Service) Accept(ctx context.Context, token string, userID uuid.UUID) (*AcceptInvitationResponse, error) {
	var result *AcceptInvitationResponse
	err := s.repo.Transaction(ctx, func(repo *Repository) error {
		invitation, err := repo.GetInvitationByTokenForUpdate(ctx, strings.TrimSpace(token))
		if err != nil {
			return err
		}
		if appErr := validateInvitation(invitation); appErr != nil {
			return appErr
		}
		if invitation.InviterUserID == userID {
			return conflict("inviter cannot accept their own invitation")
		}
		if _, err := repo.GetPermission(ctx, invitation.AccountBookID, userID); err == nil {
			return conflict("user is already a member of this account book")
		} else if !isNotFound(err) {
			return err
		}
		if err := repo.AddPermission(ctx, invitation.AccountBookID, userID, invitation.AccountRole); err != nil {
			return err
		}
		if err := repo.IncrementInvitationUsage(ctx, invitation.ID); err != nil {
			return err
		}
		if err := repo.SetDefaultAccountBookIfNull(ctx, userID, invitation.AccountBookID); err != nil {
			return err
		}
		result = &AcceptInvitationResponse{AccountBookID: invitation.AccountBookID, AccountRole: invitation.AccountRole, Joined: true}
		return nil
	})
	if err != nil {
		if appErr, ok := err.(*AppError); ok {
			return nil, appErr
		}
		if isNotFound(err) {
			return nil, notFound("invitation not found")
		}
		return nil, wrapRepoError("accept invitation", err)
	}
	return result, nil
}

func (s *Service) Revoke(ctx context.Context, invitationID uuid.UUID, userID uuid.UUID) (*InvitationResponse, error) {
	invitation, err := s.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("invitation not found")
		}
		return nil, wrapRepoError("get invitation by id", err)
	}
	role, err := s.authorization.GetAccountBookRole(ctx, userID, invitation.AccountBookID)
	if err != nil {
		if appErr, ok := err.(*authorization.AppError); ok {
			return nil, &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
		}
		return nil, internalError(err.Error())
	}
	if !authorization.CanAccessRole(role, "admin") {
		return nil, forbidden("you cannot revoke invitations for this account book")
	}
	if err := s.repo.RevokeInvitation(ctx, invitationID); err != nil {
		return nil, wrapRepoError("revoke invitation", err)
	}
	updated, err := s.repo.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return nil, wrapRepoError("reload invitation", err)
	}
	return toInvitationResponse(updated), nil
}

func validateInvitation(invitation *InvitationRecord) *AppError {
	if invitation.Status == "revoked" {
		return forbidden("invitation has been revoked")
	}
	if invitation.Status == "expired" || time.Now().After(invitation.ExpiresAt) {
		return forbidden("invitation has expired")
	}
	if invitation.UsedCount >= invitation.MaxUsage {
		return forbidden("invitation usage limit reached")
	}
	return nil
}

func isInvitationRole(role string) bool {
	switch role {
	case "viewer", "editor", "admin":
		return true
	default:
		return false
	}
}

func generateToken(size int) (string, error) {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func toInvitationResponse(record *InvitationRecord) *InvitationResponse {
	return &InvitationResponse{ID: record.ID, AccountBookID: record.AccountBookID, AccountBookName: record.AccountBookName, InviterUserID: record.InviterUserID, InviterName: record.InviterName, AccountRole: record.AccountRole, Token: record.Token, Status: record.Status, MaxUsage: record.MaxUsage, UsedCount: record.UsedCount, ExpiresAt: record.ExpiresAt, CreatedAt: record.CreatedAt, InviteURL: fmt.Sprintf("/invite/%s", record.Token)}
}

func toInvitationDetailResponse(record *InvitationRecord) *InvitationDetailResponse {
	acceptable := record.Status == "active" && time.Now().Before(record.ExpiresAt) && record.UsedCount < record.MaxUsage
	return &InvitationDetailResponse{AccountBookID: record.AccountBookID, AccountBookName: record.AccountBookName, InviterName: record.InviterName, AccountRole: record.AccountRole, Status: record.Status, MaxUsage: record.MaxUsage, UsedCount: record.UsedCount, ExpiresAt: record.ExpiresAt, Acceptable: acceptable}
}
