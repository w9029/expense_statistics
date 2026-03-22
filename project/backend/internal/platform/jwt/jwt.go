package jwt

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type Service struct {
	secret []byte
}

// token的解析结果结构
type AccessClaims struct {
	UserID    string
	UserRole  string
	IssuedAt  time.Time
	ExpiresAt time.Time
}

func New(secret string) *Service {
	return &Service{secret: []byte(secret)}
}

//造轮子，生成和解析JWT token的逻辑都自己写
func (s *Service) GenerateAccessToken(userID string, userRole string, ttl time.Duration) (string, error) {
	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	now := time.Now().UTC()
	payload := map[string]any{"sub": userID, "role": userRole, "iat": now.Unix(), "exp": now.Add(ttl).Unix()}

	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", fmt.Errorf("marshal header: %w", err)
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal payload: %w", err)
	}

	encodedHeader := encodeSegment(headerJSON)
	encodedPayload := encodeSegment(payloadJSON)
	signingInput := encodedHeader + "." + encodedPayload
	return signingInput + "." + s.sign(signingInput), nil
}

func (s *Service) ParseAccessToken(token string) (*AccessClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}
	signingInput := parts[0] + "." + parts[1]
	if !hmac.Equal([]byte(s.sign(signingInput)), []byte(parts[2])) {
		return nil, fmt.Errorf("invalid token signature")
	}

	payloadBytes, err := decodeSegment(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode payload: %w", err)
	}

	var payload struct {
		Subject string `json:"sub"`
		Role    string `json:"role"`
		Issued  int64  `json:"iat"`
		Expires int64  `json:"exp"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, fmt.Errorf("unmarshal payload: %w", err)
	}

	expiresAt := time.Unix(payload.Expires, 0).UTC()
	if time.Now().UTC().After(expiresAt) {
		return nil, fmt.Errorf("token expired")
	}

	return &AccessClaims{UserID: payload.Subject, UserRole: payload.Role, IssuedAt: time.Unix(payload.Issued, 0).UTC(), ExpiresAt: expiresAt}, nil
}

//对header.payload进行HMAC-SHA256，生成signature部分
func (s *Service) sign(input string) string {
	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(input))
	return encodeSegment(mac.Sum(nil))
}

func encodeSegment(data []byte) string { return base64.RawURLEncoding.EncodeToString(data) }
func decodeSegment(segment string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(segment)
}
