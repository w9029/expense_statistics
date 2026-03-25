package identity

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"expense-statistics-server/internal/platform/mail"

	"github.com/google/uuid"
)

// 定义token有效期
const (
	accessTokenTTL      = 15 * time.Minute
	refreshTokenTTL     = 30 * 24 * time.Hour
	verificationCodeTTL = 5 * time.Minute
)

func (s *Service) SendVerificationCode(ctx context.Context, req SendVerificationCodeRequest) error {
	purpose := normalizePurpose(req.Purpose)
	if !isAllowedPurpose(purpose) {
		return invalidRequest("invalid verification purpose")
	}
	email := strings.TrimSpace(strings.ToLower(req.Email))
	if purpose == PurposeRegister {
		existingUser, err := s.repo.GetUserByEmail(ctx, email)
		if err == nil && existingUser != nil {
			return conflict("email already registered")
		}
		if err != nil && !isNotFound(err) {
			return wrapRepoError("get user by email", err)
		}
	}
	code, err := generateCode()
	if err != nil {
		return internalError("generate verification code failed")
	}
	token, err := generateRandomToken(32)
	if err != nil {
		return internalError("generate verification token failed")
	}
	expiresAt := s.clock.Now().Add(verificationCodeTTL)
	if err := s.repo.DeleteVerificationsByEmailPurpose(ctx, email, purpose); err != nil {
		return wrapRepoError("delete old verification", err)
	}
	if err := s.repo.CreateVerification(ctx, VerificationRecord{Email: email, Code: code, Purpose: purpose, Token: &token, Verified: false, ExpiresAt: expiresAt}); err != nil {
		return wrapRepoError("create verification", err)
	}
	subject := fmt.Sprintf("[%s] verification code", strings.ToUpper(strings.ReplaceAll(purpose, " ", "_")))
	body := fmt.Sprintf("Your verification code is: %s \n\nIt expires at %s.", code, expiresAt.Format(time.RFC3339))
	if err := s.mail.Send(ctx, mail.Message{To: email, Subject: subject, Body: body}); err != nil {
		if s.logger != nil {
			s.logger.Error("send verification email failed", "email", email, "purpose", purpose, "error", err)
		}
		return internalError("send verification email failed")
	}
	return nil
}

func (s *Service) VerifyCode(ctx context.Context, req VerifyCodeRequest) (*VerifyCodeResponse, error) {
	purpose := normalizePurpose(req.Purpose)
	email := strings.TrimSpace(strings.ToLower(req.Email))
	record, err := s.repo.GetPendingVerificationByCode(ctx, email, purpose, strings.TrimSpace(req.Code))
	if err != nil {
		if isNotFound(err) {
			return nil, unauthorized("invalid or expired verification code")
		}
		return nil, wrapRepoError("get verification by code", err)
	}
	expiresAt := s.clock.Now().Add(5 * time.Minute)
	if err := s.repo.MarkVerificationVerified(ctx, record.ID, expiresAt); err != nil {
		return nil, wrapRepoError("mark verification verified", err)
	}
	token := ""
	if record.Token != nil {
		token = *record.Token
	}
	return &VerifyCodeResponse{VerificationToken: token, ExpiresAt: expiresAt}, nil
}

func (s *Service) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	email := strings.TrimSpace(strings.ToLower(req.Email))
	preferredCurrency := strings.ToUpper(strings.TrimSpace(req.PreferredCurrency))
	if !isCurrencyCode(preferredCurrency) {
		return nil, invalidRequest("preferred_currency must be 3 uppercase letters")
	}
	language := normalizeLanguage(req.Language)
	if !isSupportedLanguage(language) {
		return nil, invalidRequest("language must be zh-CN, en, or ja")
	}
	existingUser, err := s.repo.GetUserByEmail(ctx, email)
	if err == nil && existingUser != nil {
		return nil, conflict("email already registered")
	}
	if err != nil && !isNotFound(err) {
		return nil, wrapRepoError("get user by email", err)
	}
	verification, err := s.repo.GetVerifiedVerificationByToken(ctx, email, PurposeRegister, strings.TrimSpace(req.VerificationToken))
	if err != nil {
		if isNotFound(err) {
			return nil, unauthorized("invalid or expired verification token")
		}
		return nil, wrapRepoError("get verification by token", err)
	}
	passwordHash, err := hashPassword(req.Password)
	if err != nil {
		return nil, internalError("hash password failed")
	}
	var createdUser *UserRecord
	if err := s.repo.Transaction(ctx, func(repo *Repository) error {
		user, createErr := repo.CreateUser(ctx, email, passwordHash, strings.TrimSpace(req.Name), preferredCurrency, language)
		if createErr != nil {
			return createErr
		}
		createdUser = user
		return repo.DeleteVerificationByID(ctx, verification.ID)
	}); err != nil {
		return nil, wrapRepoError("register user transaction", err)
	}
	return s.issueAuthTokens(ctx, createdUser)
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (*AuthResponse, error) {
	user, err := s.repo.GetUserByEmail(ctx, strings.TrimSpace(strings.ToLower(req.Email)))
	if err != nil {
		if isNotFound(err) {
			return nil, unauthorized("invalid email or password")
		}
		return nil, wrapRepoError("get user by email", err)
	}
	if !user.IsActive {
		return nil, unauthorized("user is inactive")
	}
	if err := comparePassword(user.PasswordHash, req.Password); err != nil {
		return nil, unauthorized("invalid email or password")
	}
	return s.issueAuthTokens(ctx, user)
}

// 刷新token的流程是：
// 先根据请求中的refresh token查找数据库中对应的记录，验证它是否存在、是否过期、所属用户是否存在且活跃。
// 如果验证通过，就在一个事务中先把这个refresh token标记为已撤销，
// 然后为用户重新生成一对新的access token和refresh token，并把新的refresh token保存到数据库。
// 最后返回新的token给客户端。
func (s *Service) Refresh(ctx context.Context, req RefreshRequest) (*AuthResponse, error) {
	tokenRecord, err := s.repo.GetActiveRefreshToken(ctx, strings.TrimSpace(req.RefreshToken))
	if err != nil {
		if isNotFound(err) {
			return nil, unauthorized("invalid or expired refresh token")
		}
		return nil, wrapRepoError("get refresh token", err)
	}
	user, err := s.repo.MustGetUserByID(ctx, tokenRecord.UserID)
	if err != nil {
		if isNotFound(err) {
			return nil, unauthorized("user not found")
		}
		return nil, wrapRepoError("get user by id", err)
	}
	if !user.IsActive {
		return nil, unauthorized("user is inactive")
	}
	var result *AuthResponse
	if err := s.repo.Transaction(ctx, func(repo *Repository) error {
		if revokeErr := repo.RevokeRefreshToken(ctx, tokenRecord.ID, s.clock.Now()); revokeErr != nil {
			return revokeErr
		}
		// 事务中先撤销旧的refresh token再创建新的token记录，保证原子性。
		authResponse, issueErr := s.issueAuthTokensWithRepo(ctx, repo, user)
		if issueErr != nil {
			return issueErr
		}
		result = authResponse
		return nil
	}); err != nil {
		return nil, wrapRepoError("refresh token transaction", err)
	}
	return result, nil
}

// 生成token的默认入口，使用默认的repo
func (s *Service) UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*UserResponse, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, invalidRequest("name is required")
	}
	preferredCurrency := strings.ToUpper(strings.TrimSpace(req.PreferredCurrency))
	if !isCurrencyCode(preferredCurrency) {
		return nil, invalidRequest("preferred_currency must be 3 uppercase letters")
	}
	language := normalizeLanguage(req.Language)
	if !isSupportedLanguage(language) {
		return nil, invalidRequest("language must be zh-CN, en, or ja")
	}
	avatarPath := normalizeOptionalText(req.AvatarPath)
	user, err := s.repo.UpdateUserProfile(ctx, userID, name, preferredCurrency, language, avatarPath)
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("user not found")
		}
		return nil, wrapRepoError("update user profile", err)
	}
	response := toUserResponse(user)
	return &response, nil
}

func (s *Service) UpdateDefaultAccountBook(ctx context.Context, userID uuid.UUID, req UpdateDefaultAccountBookRequest) (*UserResponse, error) {
	if req.DefaultAccountBookID != nil {
		hasAccess, err := s.repo.UserHasAccountBookAccess(ctx, userID, *req.DefaultAccountBookID)
		if err != nil {
			return nil, wrapRepoError("check account book access", err)
		}
		if !hasAccess {
			return nil, forbidden("default account book must be an accessible account book")
		}
	}
	user, err := s.repo.UpdateDefaultAccountBook(ctx, userID, req.DefaultAccountBookID)
	if err != nil {
		if isNotFound(err) {
			return nil, notFound("user not found")
		}
		return nil, wrapRepoError("update default account book", err)
	}
	response := toUserResponse(user)
	return &response, nil
}

func (s *Service) issueAuthTokens(ctx context.Context, user *UserRecord) (*AuthResponse, error) {
	return s.issueAuthTokensWithRepo(ctx, s.repo, user)
}

// 底层版本，允许显式传入一个“事务中的repo”，为了一些需要在同一个事务中执行的场景
func (s *Service) issueAuthTokensWithRepo(ctx context.Context, repo *Repository, user *UserRecord) (*AuthResponse, error) {
	accessToken, err := s.jwt.GenerateAccessToken(user.ID.String(), user.UserRole, accessTokenTTL)
	if err != nil {
		return nil, internalError("generate access token failed")
	}
	refreshToken, err := generateRandomToken(32)
	if err != nil {
		return nil, internalError("generate refresh token failed")
	}
	expiresAt := s.clock.Now().Add(refreshTokenTTL)
	if err := repo.CreateRefreshToken(ctx, user.ID, refreshToken, expiresAt); err != nil {
		return nil, wrapRepoError("create refresh token", err)
	}
	return &AuthResponse{AccessToken: accessToken, RefreshToken: refreshToken, User: toUserResponse(user)}, nil
}

func normalizePurpose(purpose string) string {
	return strings.TrimSpace(strings.ToLower(purpose))
}

func isAllowedPurpose(purpose string) bool {
	switch purpose {
	case PurposeLogin, PurposeRegister, PurposeResetPassword, PurposeChangeEmail:
		return true
	default:
		return false
	}
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

func normalizeLanguage(language string) string {
	return strings.TrimSpace(language)
}

func isSupportedLanguage(language string) bool {
	switch language {
	case "zh-CN", "en", "ja":
		return true
	default:
		return false
	}
}

func generateCode() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}
func generateRandomToken(size int) (string, error) {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func toUserResponse(user *UserRecord) UserResponse {
	return UserResponse{
		ID:                user.ID,
		Email:             user.Email,
		Name:              user.Name,
		PreferredCurrency: user.PreferredCurrency,
		Language:          user.Language,
		UserRole:          user.UserRole,
		DefaultAccountID:  user.DefaultAccountBookID,
		AvatarPath:        user.AvatarPath,
	}
}

func normalizeOptionalText(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
