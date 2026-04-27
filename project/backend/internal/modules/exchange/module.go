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
		client:        &http.Client{Timeout: timeout},
	}
}
