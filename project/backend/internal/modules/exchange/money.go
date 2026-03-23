package exchange

import (
	"fmt"
	"strconv"
	"strings"
)

func normalizeRateString(rate string) string {
	micros, err := parseRateToMicros(rate)
	if err != nil {
		return rate
	}
	return formatRateMicros(micros)
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
