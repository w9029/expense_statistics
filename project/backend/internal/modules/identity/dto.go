package identity

import (
	"time"

	"github.com/google/uuid"
)

const (
	PurposeLogin         = "login"
	PurposeRegister      = "register"
	PurposeResetPassword = "reset password"
	PurposeChangeEmail   = "change email"
)

type SendVerificationCodeRequest struct {
	Email   string `json:"email" binding:"required,email"`
	Purpose string `json:"purpose" binding:"required"`
}

type VerifyCodeRequest struct {
	Email   string `json:"email" binding:"required,email"`
	Purpose string `json:"purpose" binding:"required"`
	Code    string `json:"code" binding:"required,len=6"`
}

type RegisterRequest struct {
	Email             string `json:"email" binding:"required,email"`
	Name              string `json:"name" binding:"required,min=1,max=100"`
	Password          string `json:"password" binding:"required,min=8,max=72"`
	PreferredCurrency string `json:"preferred_currency" binding:"required,len=3"`
	Language          string `json:"language" binding:"required"`
	VerificationToken string `json:"verification_token" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type UpdateProfileRequest struct {
	Name              string  `json:"name" binding:"required,min=1,max=100"`
	PreferredCurrency string  `json:"preferred_currency" binding:"required,len=3"`
	Language          string  `json:"language" binding:"required"`
	AvatarPath        *string `json:"avatar_path"`
}

type UpdateDefaultAccountBookRequest struct {
	DefaultAccountBookID *uuid.UUID `json:"default_account_book_id"`
}

type VerifyCodeResponse struct {
	VerificationToken string    `json:"verification_token"`
	ExpiresAt         time.Time `json:"expires_at"`
}

type AuthResponse struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	User         UserResponse `json:"user"`
}

type UserResponse struct {
	ID                uuid.UUID  `json:"id"`
	Email             string     `json:"email"`
	Name              string     `json:"name"`
	PreferredCurrency string     `json:"preferred_currency"`
	Language          string     `json:"language"`
	UserRole          string     `json:"user_role"`
	DefaultAccountID  *uuid.UUID `json:"default_account_book_id"`
	AvatarPath        *string    `json:"avatar_path"`
}
