package exchange

import "time"

type ExchangeRateRecord struct {
	BaseCurrency   string
	TargetCurrency string
	Rate           string
	RateDate       time.Time
}
