package accountbook

import (
	"context"
	"fmt"
	"strings"

	"expense-statistics-server/internal/modules/authorization"
	"expense-statistics-server/internal/modules/invitation"

	"github.com/google/uuid"
)

//为了不依赖整个invitation模块，我们在这里定义一个接口，accountbook模块只依赖这个接口来获取invitation相关的数据
type InvitationLister interface {
	ListByAccountBook(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) ([]invitation.InvitationResponse, error)
}

type Service struct {
	repo          *Repository
	authorization *authorization.Service
	invitations   InvitationLister
}

func NewService(repo *Repository, authorizationService *authorization.Service, invitationLister InvitationLister) *Service {
	return &Service{repo: repo, authorization: authorizationService, invitations: invitationLister}
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
		if appErr, ok := err.(*authorization.AppError); ok {
			return nil, &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
		}
		return nil, internalError(err.Error())
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
		if appErr, ok := err.(*authorization.AppError); ok {
			return nil, &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
		}
		return nil, internalError(err.Error())
	}
	return fromAuthorizationAccess(access), nil
}

func (s *Service) ListInvitations(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) ([]invitation.InvitationResponse, error) {
	if s.invitations == nil {
		return nil, internalError("invitation service is not configured")
	}
	result, err := s.invitations.ListByAccountBook(ctx, userID, accountBookID)
	if err != nil {
		if appErr, ok := err.(*invitation.AppError); ok {
			return nil, &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
		}
		return nil, internalError(err.Error())
	}
	return result, nil
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
