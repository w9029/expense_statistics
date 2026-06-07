package exchange

import (
	"net/http"
	"strings"
	"time"

	"expense-statistics-server/internal/platform/config"
)

type Deps struct {
	Repo   *Repository
	Config config.ExchangeConfig
}

func NewService(deps Deps) *Service {
	timeout := time.Duration(deps.Config.RequestTimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	return &Service{
		repo:          deps.Repo,
		apiKey:        strings.TrimSpace(deps.Config.APIKey),
		historicalURL: strings.TrimSpace(deps.Config.HistoricalURL),
		latestURL:     strings.TrimSpace(deps.Config.LatestURL),
		rateWindowDays: func() int {
			if deps.Config.RateWindowDays <= 0 {
				return 2
			}
			return deps.Config.RateWindowDays
		}(),
		backfillLookbackDays: func() int {
			if deps.Config.BackfillLookbackDays <= 0 {
				return 90
			}
			return deps.Config.BackfillLookbackDays
		}(),
		client:        &http.Client{Timeout: timeout},
	}
}
