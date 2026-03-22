package jwt

type Service struct {
	secret string
}

func New(secret string) *Service {
	return &Service{secret: secret}
}

func (s *Service) Secret() string {
	return s.secret
}
