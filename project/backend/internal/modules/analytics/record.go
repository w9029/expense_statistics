package analytics

import "github.com/google/uuid"

type CategoryShareRecord struct {
	CategoryID           uuid.UUID
	CategoryName         string
	CategoryColor        string
	TotalConvertedAmount string
}

type TrendPointRecord struct {
	Bucket               string
	TotalConvertedAmount string
}
