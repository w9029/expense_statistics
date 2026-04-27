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
	latestURL     string
	client        *http.Client
}

type providerHistoricalResponse struct {
	Data map[string]providerCurrencyRate `json:"data"`
}

type providerLatestResponse struct {
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

func (s *Service) SyncLatestRates(ctx context.Context, baseCurrency string, targetCurrencies []string, rateDate time.Time) (int, error) {
	base := strings.ToUpper(strings.TrimSpace(baseCurrency))
	if !isCurrencyCode(base) {
		return 0, invalidRequest("base currency must be a 3-letter uppercase code")
	}
	targets := normalizeTargetCurrencies(targetCurrencies, base)
	if len(targets) == 0 {
		return 0, invalidRequest("at least one target currency is required")
	}
	if strings.TrimSpace(s.apiKey) == "" {
		return 0, serviceUnavailable("exchange rate provider is not configured")
	}

	rates, err := s.fetchLatestRatesFromProvider(ctx, base, targets)
	if err != nil {
		return 0, err
	}

	upserted := 0
	for _, target := range targets {
		rate, ok := rates[target]
		if !ok {
			continue
		}
		if err := s.repo.UpsertRate(ctx, base, target, rate, rateDate); err != nil {
			return upserted, wrapRepoError("upsert latest exchange rate", err)
		}
		upserted++
	}
	return upserted, nil
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

func (s *Service) fetchLatestRatesFromProvider(ctx context.Context, baseCurrency string, targetCurrencies []string) (map[string]string, error) {
	if strings.TrimSpace(s.latestURL) == "" {
		return nil, serviceUnavailable("exchange rate provider is not configured")
	}

	endpoint, err := url.Parse(s.latestURL)
	if err != nil {
		return nil, internalError(fmt.Sprintf("invalid exchange provider url: %v", err))
	}
	query := endpoint.Query()
	query.Set("apikey", s.apiKey)
	query.Set("currencies", strings.Join(targetCurrencies, ","))
	query.Set("base_currency", baseCurrency)
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, internalError(fmt.Sprintf("build latest exchange rate request: %v", err))
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, serviceUnavailable("exchange rate provider is unavailable")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, rateLimited("exchange rate sync failed, please retry in 1 minute")
	}
	if resp.StatusCode >= http.StatusInternalServerError {
		return nil, serviceUnavailable("exchange rate provider is unavailable")
	}
	if resp.StatusCode != http.StatusOK {
		message := "failed to fetch latest exchange rates from provider"
		var providerErr providerErrorResponse
		if err := json.NewDecoder(resp.Body).Decode(&providerErr); err == nil && strings.TrimSpace(providerErr.Message) != "" {
			message = providerErr.Message
		}
		return nil, serviceUnavailable(message)
	}

	decoder := json.NewDecoder(resp.Body)
	decoder.UseNumber()
	var payload providerLatestResponse
	if err := decoder.Decode(&payload); err != nil {
		return nil, serviceUnavailable("invalid exchange rate response from provider")
	}

	rates := make(map[string]string, len(targetCurrencies))
	for _, target := range targetCurrencies {
		ratePayload, ok := payload.Data[target]
		if !ok || strings.TrimSpace(ratePayload.Value.String()) == "" {
			continue
		}
		normalizedRate, err := normalizeExternalRateString(ratePayload.Value.String())
		if err != nil {
			return nil, serviceUnavailable("invalid exchange rate value from provider")
		}
		rates[target] = normalizedRate
	}
	if len(rates) == 0 {
		return nil, notFound(fmt.Sprintf("latest exchange rates not found for %s -> %s", baseCurrency, strings.Join(targetCurrencies, ",")))
	}
	return rates, nil
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

func normalizeTargetCurrencies(targetCurrencies []string, baseCurrency string) []string {
	seen := make(map[string]struct{}, len(targetCurrencies))
	normalized := make([]string, 0, len(targetCurrencies))
	for _, currency := range targetCurrencies {
		code := strings.ToUpper(strings.TrimSpace(currency))
		if !isCurrencyCode(code) || code == baseCurrency {
			continue
		}
		if _, exists := seen[code]; exists {
			continue
		}
		seen[code] = struct{}{}
		normalized = append(normalized, code)
	}
	return normalized
}
