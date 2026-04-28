package exchange

import (
	"fmt"
	"math/big"
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

func normalizeExternalRateString(rate string) (string, error) {
	micros, err := parseFlexibleRateToMicros(rate)
	if err != nil {
		return "", err
	}
	return formatRateMicros(micros), nil
}

func invertRateString(rate string) (string, error) {
	micros, err := parseRateToMicros(rate)
	if err != nil {
		return "", err
	}

	const numerator int64 = 1_000_000_000_000
	inverseMicros := numerator / micros
	if remainder := numerator % micros; remainder*2 >= micros {
		inverseMicros++
	}
	if inverseMicros <= 0 {
		return "", fmt.Errorf("inverse rate must be greater than 0")
	}
	return formatRateMicros(inverseMicros), nil
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

func parseFlexibleRateToMicros(value string) (int64, error) {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return 0, fmt.Errorf("rate is required")
	}
	rat := new(big.Rat)
	if _, ok := rat.SetString(normalized); !ok {
		return 0, fmt.Errorf("rate must be numeric")
	}
	if rat.Sign() <= 0 {
		return 0, fmt.Errorf("rate must be greater than 0")
	}

	scaled := new(big.Rat).Mul(rat, big.NewRat(1_000_000, 1))
	quotient := new(big.Int)
	remainder := new(big.Int)
	quotient.QuoRem(scaled.Num(), scaled.Denom(), remainder)
	if new(big.Int).Mul(remainder, big.NewInt(2)).Cmp(scaled.Denom()) >= 0 {
		quotient.Add(quotient, big.NewInt(1))
	}
	if !quotient.IsInt64() {
		return 0, fmt.Errorf("rate is too large")
	}
	micros := quotient.Int64()
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
