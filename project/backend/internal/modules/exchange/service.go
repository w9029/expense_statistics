package exchange

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const rateWindowDays = 2

type Service struct {
	repo          *Repository
	apiKey        string
	historicalURL string
	client        *http.Client
}

type providerHistoricalResponse struct {
	Data map[string]providerCurrencyRate `json:"data"`
}

type providerCurrencyRate struct {
	Code  string      `json:"code"`
	Value json.Number `json:"value"`
}

type providerErrorResponse struct {
	Message string `json:"message"`
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

	windowStart := rateDate.AddDate(0, 0, -rateWindowDays)
	record, err := s.repo.FindLatestRateInWindow(ctx, source, target, windowStart, rateDate)
	if err == nil {
		return s.rateFromRecord(*record, source, target)
	}
	if !isNotFound(err) {
		return "", wrapRepoError("resolve exchange rate", err)
	}

	if strings.TrimSpace(s.apiKey) == "" {
		return "", notFound(fmt.Sprintf("exchange rate not found for %s -> %s between %s and %s", source, target, windowStart.Format("2006-01-02"), rateDate.Format("2006-01-02")))
	}

	fetchedRate, fetchErr := s.fetchRateFromProvider(ctx, source, target, rateDate)
	if fetchErr != nil {
		return "", fetchErr
	}
	if err := s.repo.UpsertRate(ctx, source, target, fetchedRate, rateDate); err != nil {
		return "", wrapRepoError("upsert fetched exchange rate", err)
	}
	return fetchedRate, nil
}

func (s *Service) rateFromRecord(record ExchangeRateRecord, sourceCurrency string, targetCurrency string) (string, error) {
	rate := normalizeRateString(record.Rate)
	if record.BaseCurrency == sourceCurrency && record.TargetCurrency == targetCurrency {
		return rate, nil
	}
	inverseRate, err := invertRateString(rate)
	if err != nil {
		return "", internalError(fmt.Sprintf("invert exchange rate: %v", err))
	}
	return inverseRate, nil
}

func (s *Service) fetchRateFromProvider(ctx context.Context, sourceCurrency string, targetCurrency string, rateDate time.Time) (string, error) {
	if strings.TrimSpace(s.historicalURL) == "" {
		return "", serviceUnavailable("exchange rate provider is not configured")
	}

	endpoint, err := url.Parse(s.historicalURL)
	if err != nil {
		return "", internalError(fmt.Sprintf("invalid exchange provider url: %v", err))
	}
	query := endpoint.Query()
	query.Set("apikey", s.apiKey)
	query.Set("currencies", targetCurrency)
	query.Set("base_currency", sourceCurrency)
	query.Set("date", rateDate.Format("2006-01-02"))
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return "", internalError(fmt.Sprintf("build exchange rate request: %v", err))
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return "", serviceUnavailable("exchange rate provider is unavailable")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return "", rateLimited("expense save failed, please retry in 1 minute")
	}
	if resp.StatusCode >= http.StatusInternalServerError {
		return "", serviceUnavailable("exchange rate provider is unavailable")
	}
	if resp.StatusCode != http.StatusOK {
		message := "failed to fetch exchange rate from provider"
		var providerErr providerErrorResponse
		if err := json.NewDecoder(resp.Body).Decode(&providerErr); err == nil && strings.TrimSpace(providerErr.Message) != "" {
			message = providerErr.Message
		}
		return "", serviceUnavailable(message)
	}

	decoder := json.NewDecoder(resp.Body)
	decoder.UseNumber()
	var payload providerHistoricalResponse
	if err := decoder.Decode(&payload); err != nil {
		return "", serviceUnavailable("invalid exchange rate response from provider")
	}

	ratePayload, ok := payload.Data[targetCurrency]
	if !ok || strings.TrimSpace(ratePayload.Value.String()) == "" {
		return "", notFound(fmt.Sprintf("exchange rate not found for %s -> %s on %s", sourceCurrency, targetCurrency, rateDate.Format("2006-01-02")))
	}

	normalizedRate, err := normalizeExternalRateString(ratePayload.Value.String())
	if err != nil {
		return "", serviceUnavailable("invalid exchange rate value from provider")
	}
	return normalizedRate, nil
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
