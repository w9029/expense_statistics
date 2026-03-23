package exchange

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ResolveRate(ctx context.Context, sourceCurrency string, targetCurrency string, rateDate time.Time) (string, error) {
	source := strings.ToUpper(strings.TrimSpace(sourceCurrency))
	target := strings.ToUpper(strings.TrimSpace(targetCurrency))
	if !isCurrencyCode(source) || !isCurrencyCode(target) {
		return "", invalidRequest("currency must be a 3-letter uppercase code")
	}
	if source == target {
		return "1.000000", nil
	}

	rate, err := s.repo.GetRate(ctx, source, target, rateDate)
	if err != nil {
		if isNotFound(err) {
			return "", notFound(fmt.Sprintf("exchange rate not found for %s -> %s on %s", source, target, rateDate.Format("2006-01-02")))
		}
		return "", wrapRepoError("resolve exchange rate", err)
	}
	return normalizeRateString(rate), nil
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
