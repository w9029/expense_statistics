package ledger

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func parseAmountToCents(value string) (int64, error) {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return 0, fmt.Errorf("amount is required")
	}
	parts := strings.Split(normalized, ".")
	if len(parts) > 2 {
		return 0, fmt.Errorf("amount must have at most 2 decimal places")
	}
	wholePart := parts[0]
	if wholePart == "" {
		wholePart = "0"
	}
	whole, err := strconv.ParseInt(wholePart, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("amount must be numeric")
	}
	fraction := int64(0)
	if len(parts) == 2 {
		fractionPart := parts[1]
		if len(fractionPart) > 2 {
			return 0, fmt.Errorf("amount must have at most 2 decimal places")
		}
		if len(fractionPart) == 1 {
			fractionPart += "0"
		}
		if fractionPart != "" {
			fraction, err = strconv.ParseInt(fractionPart, 10, 64)
			if err != nil {
				return 0, fmt.Errorf("amount must be numeric")
			}
		}
	}
	cents := whole*100 + fraction
	if cents <= 0 {
		return 0, fmt.Errorf("amount must be greater than 0")
	}
	return cents, nil
}

func formatCents(cents int64) string {
	whole := cents / 100
	fraction := cents % 100
	if fraction < 0 {
		fraction = -fraction
	}
	return fmt.Sprintf("%d.%02d", whole, fraction)
}

func parseRateToMicros(value string) (int64, error) {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return 0, fmt.Errorf("rate is required")
	}
	parts := strings.Split(normalized, ".")
	if len(parts) > 2 {
		return 0, fmt.Errorf("rate must have at most 6 decimal places")
	}
	whole, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("rate must be numeric")
	}
	fraction := int64(0)
	if len(parts) == 2 {
		fractionPart := parts[1]
		if len(fractionPart) > 6 {
			return 0, fmt.Errorf("rate must have at most 6 decimal places")
		}
		fractionPart += strings.Repeat("0", 6-len(fractionPart))
		fraction, err = strconv.ParseInt(fractionPart, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("rate must be numeric")
		}
	}
	micros := whole*1_000_000 + fraction
	if micros <= 0 {
		return 0, fmt.Errorf("rate must be greater than 0")
	}
	return micros, nil
}

func formatRateMicros(micros int64) string {
	whole := micros / 1_000_000
	fraction := micros % 1_000_000
	if fraction < 0 {
		fraction = -fraction
	}
	return fmt.Sprintf("%d.%06d", whole, fraction)
}

func convertCentsByRate(amountCents int64, rateMicros int64) int64 {
	return (amountCents*rateMicros + 500_000) / 1_000_000
}

func allocateMergedChildrenFromPretax(parentTotalCents int64, inputCents []int64) ([]int64, error) {
	if len(inputCents) == 0 {
		return nil, fmt.Errorf("children are required")
	}
	sumInput := int64(0)
	largestIndex := 0
	for i, cents := range inputCents {
		sumInput += cents
		if cents > inputCents[largestIndex] {
			largestIndex = i
		}
	}
	if sumInput <= 0 {
		return nil, fmt.Errorf("children total must be greater than 0")
	}
	allocated := make([]int64, len(inputCents))
	sumAllocated := int64(0)
	for i, cents := range inputCents {
		allocated[i] = (cents*parentTotalCents + sumInput/2) / sumInput
		sumAllocated += allocated[i]
	}
	remainder := parentTotalCents - sumAllocated
	allocated[largestIndex] += remainder
	if allocated[largestIndex] <= 0 {
		return nil, fmt.Errorf("allocated child amount must remain positive")
	}
	return allocated, nil
}

func parseSpentAt(value string) (time.Time, error) {
	date, err := time.Parse("2006-01-02", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, fmt.Errorf("spent_at must be in YYYY-MM-DD format")
	}
	return date, nil
}

func normalizeCurrency(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func validateColor(value string) bool {
	return colorPattern.MatchString(strings.TrimSpace(value))
}
