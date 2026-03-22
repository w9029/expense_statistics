package accountbook

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"expense-statistics-server/internal/modules/authorization"
	"expense-statistics-server/internal/modules/invitation"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InvitationManager interface {
	ListByAccountBook(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) ([]invitation.InvitationResponse, error)
	DeleteByAccountBook(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, invitationID uuid.UUID) (*invitation.DeleteInvitationResponse, error)
}

type Service struct {
	repo          *Repository
	authorization *authorization.Service
	invitations   InvitationManager
}

func NewService(repo *Repository, authorizationService *authorization.Service, invitationManager InvitationManager) *Service {
	return &Service{repo: repo, authorization: authorizationService, invitations: invitationManager}
}

func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreateAccountBookRequest) (*AccountBookDetailResponse, error) {
	name := strings.TrimSpace(req.Name)
	description := normalizeDescription(req.Description)
	baseCurrency := strings.ToUpper(strings.TrimSpace(req.BaseCurrency))
	if name == "" {
		return nil, invalidRequest("name is required")
	}
	if !isCurrencyCode(baseCurrency) {
		return nil, invalidRequest("base_currency must be 3 uppercase letters")
	}

	var created AccountBookRecord
	if err := s.repo.Transaction(ctx, func(repo *Repository) error {
		record, err := repo.CreateAccountBook(ctx, userID, name, baseCurrency, description)
		if err != nil {
			return err
		}
		if err := repo.AddPermission(ctx, record.ID, userID, "owner"); err != nil {
			return err
		}
		if err := repo.SetDefaultAccountBookIfNull(ctx, userID, record.ID); err != nil {
			return err
		}
		detail, err := repo.GetAccessibleByID(ctx, userID, record.ID)
		if err != nil {
			return err
		}
		created = *detail
		return nil
	}); err != nil {
		return nil, internalError(fmt.Sprintf("create account book: %v", err))
	}
	return toDetailResponse(created), nil
}

func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]AccountBookSummaryResponse, error) {
	records, err := s.repo.ListAccessible(ctx, userID)
	if err != nil {
		return nil, internalError(fmt.Sprintf("list account books: %v", err))
	}
	result := make([]AccountBookSummaryResponse, 0, len(records))
	for _, record := range records {
		result = append(result, toSummaryResponse(record))
	}
	return result, nil
}

func (s *Service) GetByID(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) (*AccountBookDetailResponse, error) {
	if _, err := s.authorization.GetAccountBookRole(ctx, userID, accountBookID); err != nil {
		return nil, mapAuthorizationError(err)
	}
	record, err := s.repo.GetAccessibleByID(ctx, userID, accountBookID)
	if err != nil {
		return nil, internalError(fmt.Sprintf("get account book: %v", err))
	}
	return toDetailResponse(*record), nil
}

func (s *Service) GetAccess(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) (*AccountBookAccessResponse, error) {
	access, err := s.authorization.GetAccountBookAccess(ctx, userID, accountBookID)
	if err != nil {
		return nil, mapAuthorizationError(err)
	}
	return fromAuthorizationAccess(access), nil
}

func (s *Service) ListMembers(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) ([]AccountBookMemberResponse, error) {
	if _, err := s.authorization.GetAccountBookRole(ctx, userID, accountBookID); err != nil {
		return nil, mapAuthorizationError(err)
	}
	records, err := s.repo.ListMembers(ctx, accountBookID)
	if err != nil {
		return nil, wrapRepoError("list account book members", err)
	}
	result := make([]AccountBookMemberResponse, 0, len(records))
	for _, record := range records {
		result = append(result, toMemberResponse(record, userID))
	}
	return result, nil
}

func (s *Service) ListInvitations(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) ([]invitation.InvitationResponse, error) {
	if s.invitations == nil {
		return nil, internalError("invitation service is not configured")
	}
	result, err := s.invitations.ListByAccountBook(ctx, userID, accountBookID)
	if err != nil {
		return nil, mapInvitationError(err)
	}
	return result, nil
}

func (s *Service) DeleteInvitation(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, invitationID uuid.UUID) (*invitation.DeleteInvitationResponse, error) {
	if s.invitations == nil {
		return nil, internalError("invitation service is not configured")
	}
	result, err := s.invitations.DeleteByAccountBook(ctx, userID, accountBookID, invitationID)
	if err != nil {
		return nil, mapInvitationError(err)
	}
	return result, nil
}

func (s *Service) TransferOwner(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, req TransferOwnerRequest) (*AccountBookOwnerTransferResponse, error) {
	if req.TargetUserID == uuid.Nil {
		return nil, invalidRequest("target_user_id is required")
	}
	role, err := s.authorization.GetAccountBookRole(ctx, userID, accountBookID)
	if err != nil {
		return nil, mapAuthorizationError(err)
	}
	if role != "owner" {
		return nil, forbidden("only the owner can transfer account book ownership")
	}
	if req.TargetUserID == userID {
		return nil, conflict("target user is already the owner")
	}

	if err := s.repo.Transaction(ctx, func(repo *Repository) error {
		targetRole, err := repo.GetMemberRole(ctx, accountBookID, req.TargetUserID)
		if err != nil {
			if isRepoNotFound(err) {
				return notFound("target user is not a member of this account book")
			}
			return err
		}
		if targetRole == "owner" {
			return conflict("target user is already the owner")
		}
		if err := repo.UpdateMemberRole(ctx, accountBookID, userID, "admin"); err != nil {
			return err
		}
		if err := repo.UpdateMemberRole(ctx, accountBookID, req.TargetUserID, "owner"); err != nil {
			return err
		}
		if err := repo.UpdateOwnerUserID(ctx, accountBookID, req.TargetUserID); err != nil {
			return err
		}
		return nil
	}); err != nil {
		if appErr, ok := err.(*AppError); ok {
			return nil, appErr
		}
		if isRepoNotFound(err) {
			return nil, notFound("target user is not a member of this account book")
		}
		return nil, wrapRepoError("transfer account book owner", err)
	}

	return &AccountBookOwnerTransferResponse{AccountBookID: accountBookID, PreviousOwnerUserID: userID, NewOwnerUserID: req.TargetUserID, Transferred: true}, nil
}

func (s *Service) RemoveMember(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, targetUserID uuid.UUID) (*AccountBookMemberRemovalResponse, error) {
	if targetUserID == uuid.Nil {
		return nil, invalidRequest("user_id is required")
	}
	role, err := s.authorization.GetAccountBookRole(ctx, userID, accountBookID)
	if err != nil {
		return nil, mapAuthorizationError(err)
	}
	if role != "owner" {
		return nil, forbidden("only the owner can remove account book members")
	}
	if targetUserID == userID {
		return nil, conflict("owner cannot remove themselves")
	}

	if err := s.repo.Transaction(ctx, func(repo *Repository) error {
		targetRole, err := repo.GetMemberRole(ctx, accountBookID, targetUserID)
		if err != nil {
			if isRepoNotFound(err) {
				return notFound("target user is not a member of this account book")
			}
			return err
		}
		if targetRole == "owner" {
			return forbidden("owner cannot be removed")
		}
		if err := repo.RemoveMember(ctx, accountBookID, targetUserID); err != nil {
			return err
		}
		if err := repo.ClearDefaultAccountBook(ctx, targetUserID, accountBookID); err != nil {
			return err
		}
		return nil
	}); err != nil {
		if appErr, ok := err.(*AppError); ok {
			return nil, appErr
		}
		if isRepoNotFound(err) {
			return nil, notFound("target user is not a member of this account book")
		}
		return nil, wrapRepoError("remove account book member", err)
	}

	return &AccountBookMemberRemovalResponse{AccountBookID: accountBookID, UserID: targetUserID, Removed: true}, nil
}

func (s *Service) Leave(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) (*AccountBookLeaveResponse, error) {
	role, err := s.authorization.GetAccountBookRole(ctx, userID, accountBookID)
	if err != nil {
		return nil, mapAuthorizationError(err)
	}
	if role == "owner" {
		return nil, forbidden("owner cannot leave the account book; transfer ownership first")
	}

	if err := s.repo.Transaction(ctx, func(repo *Repository) error {
		if err := repo.RemoveMember(ctx, accountBookID, userID); err != nil {
			return err
		}
		if err := repo.ClearDefaultAccountBook(ctx, userID, accountBookID); err != nil {
			return err
		}
		return nil
	}); err != nil {
		if isRepoNotFound(err) {
			return nil, notFound("you are not a member of this account book")
		}
		return nil, wrapRepoError("leave account book", err)
	}

	return &AccountBookLeaveResponse{AccountBookID: accountBookID, Left: true}, nil
}

func (s *Service) Delete(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) (*AccountBookDeleteResponse, error) {
	role, err := s.authorization.GetAccountBookRole(ctx, userID, accountBookID)
	if err != nil {
		return nil, mapAuthorizationError(err)
	}
	if role != "owner" {
		return nil, forbidden("only the owner can delete the account book")
	}

	if err := s.repo.Transaction(ctx, func(repo *Repository) error {
		otherMembersCount, err := repo.CountMembersExcluding(ctx, accountBookID, userID)
		if err != nil {
			return err
		}
		// 删除前确保没有其它用户存在于这个account book
		if otherMembersCount > 0 {
			return conflict("account book still has other members")
		}
		if err := repo.ClearDefaultAccountBookForUsers(ctx, accountBookID); err != nil {
			return err
		}
		if err := repo.DeleteInvitationsByAccountBookID(ctx, accountBookID); err != nil {
			return err
		}
		if err := repo.DeletePermissionsByAccountBookID(ctx, accountBookID); err != nil {
			return err
		}
		if err := repo.SoftDeleteAccountBook(ctx, accountBookID); err != nil {
			return err
		}
		return nil
	}); err != nil {
		if appErr, ok := err.(*AppError); ok {
			return nil, appErr
		}
		if isRepoNotFound(err) {
			return nil, notFound("account book not found")
		}
		return nil, wrapRepoError("delete account book", err)
	}

	return &AccountBookDeleteResponse{AccountBookID: accountBookID, Deleted: true}, nil
}

func mapAuthorizationError(err error) *AppError {
	if appErr, ok := err.(*authorization.AppError); ok {
		return &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
	}
	return internalError(err.Error())
}

func mapInvitationError(err error) *AppError {
	if appErr, ok := err.(*invitation.AppError); ok {
		return &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
	}
	return internalError(err.Error())
}

func isRepoNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}

func isCurrencyCode(code string) bool {
	if len(code) != 3 {
		return false
	}
	for _, ch := range code {
		if ch < 'A' || ch > 'Z' {
			return false
		}
	}
	return true
}

func normalizeDescription(description *string) *string {
	if description == nil {
		return nil
	}
	value := strings.TrimSpace(*description)
	if value == "" {
		return nil
	}
	return &value
}
