package authorization

import (
	"context"

	"github.com/google/uuid"
)

func (s *Service) CurrentPrincipal(userID uuid.UUID, userRole string) *CurrentPrincipalResponse {
	return &CurrentPrincipalResponse{UserID: userID, UserRole: userRole}
}

func (s *Service) GetAccountBookAccess(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) (*AccountBookAccessResponse, error) {
	permission, err := s.repo.GetAccountBookPermission(ctx, userID, accountBookID)
	if err != nil {
		if isNotFound(err) {
			return nil, forbidden("you do not have access to this account book")
		}
		return nil, wrapRepoError("get account book permission", err)
	}
	return &AccountBookAccessResponse{AccountBookID: permission.AccountBookID, AccountRole: permission.AccountRole, AllowedActions: allowedActions(permission.AccountRole)}, nil
}

func (s *Service) GetAccountBookRole(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) (string, error) {
	permission, err := s.repo.GetAccountBookPermission(ctx, userID, accountBookID)
	if err != nil {
		if isNotFound(err) {
			return "", forbidden("you do not have access to this account book")
		}
		return "", wrapRepoError("get account book permission", err)
	}
	return permission.AccountRole, nil
}

func CanAccessRole(actualRole string, requiredRole string) bool {
	return roleRank(actualRole) >= roleRank(requiredRole)
}

func allowedActions(role string) []string {
	actions := []string{"read"}
	if CanAccessRole(role, "editor") {
		actions = append(actions, "write")
	}
	if CanAccessRole(role, "admin") {
		actions = append(actions, "manage_members", "manage_invitations")
	}
	if CanAccessRole(role, "owner") {
		actions = append(actions, "transfer_owner", "delete_account_book")
	}
	return actions
}

func roleRank(role string) int {
	switch role {
	case "viewer":
		return 1
	case "editor":
		return 2
	case "admin":
		return 3
	case "owner":
		return 4
	default:
		return 0
	}
}
