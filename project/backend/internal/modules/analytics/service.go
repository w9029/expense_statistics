package analytics

import (
	"context"
	"strconv"
	"strings"
	"time"

	"expense-statistics-server/internal/modules/authorization"

	"github.com/google/uuid"
)

type Service struct {
	repo          *Repository
	authorization *authorization.Service
}

func NewService(repo *Repository, authorizationService *authorization.Service) *Service {
	return &Service{repo: repo, authorization: authorizationService}
}

func (s *Service) GetCategoryShare(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, query CategoryShareQuery) (*CategoryShareResponse, error) {
	if err := s.requireViewer(ctx, userID, accountBookID); err != nil {
		return nil, err
	}
	filters, err := s.normalizeCategoryShareFilters(accountBookID, query)
	if err != nil {
		return nil, err
	}
	records, err := s.repo.ListCategoryShare(ctx, filters)
	if err != nil {
		return nil, wrapServiceError("list category share", err)
	}
	totalConvertedAmount, err := s.repo.SumLeafExpenses(ctx, filters)
	if err != nil {
		return nil, wrapServiceError("sum category share", err)
	}
	totalFloat, err := strconv.ParseFloat(totalConvertedAmount, 64)
	if err != nil {
		return nil, internalError("invalid aggregated amount")
	}
	items := make([]CategoryShareItemResponse, 0, len(records))
	for _, record := range records {
		itemTotalFloat, parseErr := strconv.ParseFloat(record.TotalConvertedAmount, 64)
		if parseErr != nil {
			return nil, internalError("invalid aggregated amount")
		}
		percentage := 0.0
		if totalFloat > 0 {
			percentage = itemTotalFloat / totalFloat * 100
		}
		items = append(items, CategoryShareItemResponse{
			CategoryID:           record.CategoryID,
			CategoryName:         record.CategoryName,
			CategoryColor:        record.CategoryColor,
			TotalConvertedAmount: record.TotalConvertedAmount,
			Percentage:           percentage,
		})
	}
	return &CategoryShareResponse{
		DateFrom:             filters.DateFrom.Format("2006-01-02"),
		DateTo:               filters.DateTo.Format("2006-01-02"),
		TotalConvertedAmount: totalConvertedAmount,
		Items:                items,
	}, nil
}

func (s *Service) GetSpendingTrend(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID, query SpendingTrendQuery) (*SpendingTrendResponse, error) {
	if err := s.requireViewer(ctx, userID, accountBookID); err != nil {
		return nil, err
	}
	params, err := s.normalizeTrendParams(accountBookID, query)
	if err != nil {
		return nil, err
	}
	records, err := s.repo.ListTrendPoints(ctx, params)
	if err != nil {
		return nil, wrapServiceError("list spending trend", err)
	}
	items, totalConvertedAmount, err := buildTrendSeries(params.Bucket, params.DateFrom, params.DateTo, records)
	if err != nil {
		return nil, err
	}
	return &SpendingTrendResponse{
		Bucket:               params.Bucket,
		DateFrom:             params.DateFrom.Format("2006-01-02"),
		DateTo:               params.DateTo.Format("2006-01-02"),
		TotalConvertedAmount: totalConvertedAmount,
		Items:                items,
	}, nil
}

func (s *Service) requireViewer(ctx context.Context, userID uuid.UUID, accountBookID uuid.UUID) error {
	role, err := s.authorization.GetAccountBookRole(ctx, userID, accountBookID)
	if err != nil {
		return mapAuthorizationError(err)
	}
	if !authorization.CanAccessRole(role, "viewer") {
		return forbidden("you do not have permission to view analytics")
	}
	return nil
}

func (s *Service) normalizeCategoryShareFilters(accountBookID uuid.UUID, query CategoryShareQuery) (analyticsFilters, error) {
	today := truncateDate(time.Now())
	defaultFrom := today.AddDate(0, 0, -29)
	return normalizeDateFilters(accountBookID, query.DateFrom, query.DateTo, defaultFrom, today)
}

func (s *Service) normalizeTrendParams(accountBookID uuid.UUID, query SpendingTrendQuery) (trendParams, error) {
	bucket := "day"
	if query.Bucket != nil && strings.TrimSpace(*query.Bucket) != "" {
		bucket = strings.ToLower(strings.TrimSpace(*query.Bucket))
	}
	if bucket != "day" && bucket != "month" {
		return trendParams{}, invalidRequest("bucket must be day or month")
	}

	today := truncateDate(time.Now())
	defaultFrom := today.AddDate(0, 0, -29)
	if bucket == "month" {
		defaultFrom = time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, today.Location()).AddDate(0, -11, 0)
	}
	filters, err := normalizeTrendDateFilters(accountBookID, bucket, query.DateFrom, query.DateTo, defaultFrom, today)
	if err != nil {
		return trendParams{}, err
	}

	if bucket == "day" {
		if filters.DateTo.Sub(filters.DateFrom).Hours() > 24*60 {
			return trendParams{}, invalidRequest("daily trend supports at most 60 days")
		}
	} else {
		if monthSpan(filters.DateFrom, filters.DateTo) > 24 {
			return trendParams{}, invalidRequest("monthly trend supports at most 24 months")
		}
	}

	return trendParams{analyticsFilters: filters, Bucket: bucket}, nil
}

func normalizeDateFilters(accountBookID uuid.UUID, dateFromInput *string, dateToInput *string, defaultDateFrom time.Time, defaultDateTo time.Time) (analyticsFilters, error) {
	filters := analyticsFilters{AccountBookID: accountBookID, DateFrom: truncateDate(defaultDateFrom), DateTo: truncateDate(defaultDateTo)}
	if dateFromInput != nil && strings.TrimSpace(*dateFromInput) != "" {
		date, err := parseDate(*dateFromInput)
		if err != nil {
			return analyticsFilters{}, err
		}
		filters.DateFrom = date
	}
	if dateToInput != nil && strings.TrimSpace(*dateToInput) != "" {
		date, err := parseDate(*dateToInput)
		if err != nil {
			return analyticsFilters{}, err
		}
		filters.DateTo = date
	}
	if filters.DateFrom.After(filters.DateTo) {
		return analyticsFilters{}, invalidRequest("date_from cannot be after date_to")
	}
	return filters, nil
}

func normalizeTrendDateFilters(accountBookID uuid.UUID, bucket string, dateFromInput *string, dateToInput *string, defaultDateFrom time.Time, defaultDateTo time.Time) (analyticsFilters, error) {
	if bucket != "month" {
		return normalizeDateFilters(accountBookID, dateFromInput, dateToInput, defaultDateFrom, defaultDateTo)
	}

	filters := analyticsFilters{AccountBookID: accountBookID, DateFrom: monthStart(defaultDateFrom), DateTo: monthEnd(defaultDateTo)}
	if dateFromInput != nil && strings.TrimSpace(*dateFromInput) != "" {
		date, err := parseMonth(*dateFromInput)
		if err != nil {
			return analyticsFilters{}, err
		}
		filters.DateFrom = monthStart(date)
	}
	if dateToInput != nil && strings.TrimSpace(*dateToInput) != "" {
		date, err := parseMonth(*dateToInput)
		if err != nil {
			return analyticsFilters{}, err
		}
		filters.DateTo = monthEnd(date)
	}
	if filters.DateFrom.After(filters.DateTo) {
		return analyticsFilters{}, invalidRequest("date_from cannot be after date_to")
	}
	return filters, nil
}

func buildTrendSeries(bucket string, dateFrom time.Time, dateTo time.Time, records []TrendPointRecord) ([]SpendingTrendPointResponse, string, error) {
	values := make(map[string]string, len(records))
	total := 0.0
	for _, record := range records {
		values[record.Bucket] = record.TotalConvertedAmount
		amount, err := strconv.ParseFloat(record.TotalConvertedAmount, 64)
		if err != nil {
			return nil, "", internalError("invalid aggregated amount")
		}
		total += amount
	}
	items := make([]SpendingTrendPointResponse, 0)
	if bucket == "day" {
		for current := dateFrom; !current.After(dateTo); current = current.AddDate(0, 0, 1) {
			key := current.Format("2006-01-02")
			items = append(items, SpendingTrendPointResponse{Bucket: key, TotalConvertedAmount: defaultTrendValue(values, key)})
		}
	} else {
		current := time.Date(dateFrom.Year(), dateFrom.Month(), 1, 0, 0, 0, 0, dateFrom.Location())
		endMonth := time.Date(dateTo.Year(), dateTo.Month(), 1, 0, 0, 0, 0, dateTo.Location())
		for !current.After(endMonth) {
			key := current.Format("2006-01")
			items = append(items, SpendingTrendPointResponse{Bucket: key, TotalConvertedAmount: defaultTrendValue(values, key)})
			current = current.AddDate(0, 1, 0)
		}
	}
	return items, strconv.FormatFloat(total, 'f', 2, 64), nil
}

func defaultTrendValue(values map[string]string, key string) string {
	if value, ok := values[key]; ok {
		return value
	}
	return "0.00"
}

func parseDate(value string) (time.Time, error) {
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, invalidRequest("date must be YYYY-MM-DD")
	}
	return parsed, nil
}

func parseMonth(value string) (time.Time, error) {
	parsed, err := time.Parse("2006-01", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, invalidRequest("month must be YYYY-MM")
	}
	return parsed, nil
}

func truncateDate(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, value.Location())
}

func monthStart(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), 1, 0, 0, 0, 0, value.Location())
}

func monthEnd(value time.Time) time.Time {
	return monthStart(value).AddDate(0, 1, -1)
}

func monthSpan(dateFrom time.Time, dateTo time.Time) int {
	return (dateTo.Year()-dateFrom.Year())*12 + int(dateTo.Month()-dateFrom.Month()) + 1
}

func mapAuthorizationError(err error) *AppError {
	if appErr, ok := err.(*authorization.AppError); ok {
		return &AppError{Status: appErr.Status, Code: appErr.Code, Message: appErr.Message}
	}
	return internalError(err.Error())
}

func wrapServiceError(message string, err error) *AppError {
	return internalError(message + ": " + err.Error())
}

