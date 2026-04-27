package analytics

import (
	"time"

	"github.com/google/uuid"
)

type CategoryShareQuery struct {
	DateFrom *string `form:"date_from"`
	DateTo   *string `form:"date_to"`
}

type SpendingTrendQuery struct {
	Bucket   *string `form:"bucket"`
	DateFrom *string `form:"date_from"`
	DateTo   *string `form:"date_to"`
}

type CategoryShareItemResponse struct {
	CategoryID           uuid.UUID `json:"category_id"`
	CategoryName         string    `json:"category_name"`
	CategoryColor        string    `json:"category_color"`
	TotalConvertedAmount string    `json:"total_converted_amount"`
	Percentage           float64   `json:"percentage"`
}

type CategoryShareResponse struct {
	DateFrom             string                      `json:"date_from"`
	DateTo               string                      `json:"date_to"`
	TotalConvertedAmount string                      `json:"total_converted_amount"`
	Items                []CategoryShareItemResponse `json:"items"`
}

type SpendingTrendPointResponse struct {
	Bucket               string `json:"bucket"`
	TotalConvertedAmount string `json:"total_converted_amount"`
}

type SpendingTrendResponse struct {
	Bucket               string                       `json:"bucket"`
	DateFrom             string                       `json:"date_from"`
	DateTo               string                       `json:"date_to"`
	TotalConvertedAmount string                       `json:"total_converted_amount"`
	Items                []SpendingTrendPointResponse `json:"items"`
}

type analyticsFilters struct {
	AccountBookID uuid.UUID
	DateFrom      time.Time
	DateTo        time.Time
}

type trendParams struct {
	analyticsFilters
	Bucket string
}
