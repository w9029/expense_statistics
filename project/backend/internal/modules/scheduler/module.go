package scheduler

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"expense-statistics-server/internal/modules/exchange"
	"expense-statistics-server/internal/platform/clock"
	"expense-statistics-server/internal/platform/config"
)

type Service struct {
	logger   *slog.Logger
	clock    clock.Clock
	exchange *exchange.Service
	config   config.ExchangeSchedulerConfig
	mu       sync.Mutex
}

type Deps struct {
	Logger   *slog.Logger
	Clock    clock.Clock
	Exchange *exchange.Service
	Config   config.ExchangeSchedulerConfig
}

const syncRetryInterval = time.Minute

func NewService(deps Deps) *Service {
	return &Service{
		logger:   deps.Logger,
		clock:    deps.Clock,
		exchange: deps.Exchange,
		config:   deps.Config,
	}
}

func (s *Service) Start(ctx context.Context) {
	if !s.config.Enabled {
		s.logger.Info("exchange rate scheduler disabled")
		return
	}

	location, err := time.LoadLocation(strings.TrimSpace(s.config.TimeZone))
	if err != nil {
		s.logger.Error("load exchange scheduler timezone failed", "timezone", s.config.TimeZone, "error", err)
		return
	}

	hour, minute, err := parseDailyRunAt(s.config.DailyRunAt)
	if err != nil {
		s.logger.Error("invalid exchange scheduler time", "daily_run_at", s.config.DailyRunAt, "error", err)
		return
	}

	if s.config.StartupSync {
		go s.runSyncWithRetry(ctx, location, "startup")
	}

	go s.loop(ctx, location, hour, minute)
}

func (s *Service) loop(ctx context.Context, location *time.Location, hour int, minute int) {
	for {
		nextRun := nextRunAt(s.clock.Now(), location, hour, minute)
		waitDuration := nextRun.Sub(s.clock.Now().In(location))
		if waitDuration < 0 {
			waitDuration = time.Second
		}

		s.logger.Info("exchange rate scheduler waiting", "next_run_at", nextRun.Format(time.RFC3339), "timezone", location.String())

		timer := time.NewTimer(waitDuration)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}

		s.runSyncWithRetry(ctx, location, "daily")
	}
}

func (s *Service) runSyncWithRetry(ctx context.Context, location *time.Location, trigger string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for {
		now := s.clock.Now().In(location)
		rateDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
		runCtx, cancel := context.WithTimeout(ctx, 30*time.Second)

		result, err := s.exchange.SyncScheduledRates(
			runCtx,
			s.config.BaseCurrency,
			s.config.TargetCurrencies,
			rateDate,
		)
		cancel()

		if err == nil {
			s.logger.Info("exchange rate sync completed", "trigger", trigger, "rate_date", rateDate.Format("2006-01-02"), "base_currency", s.config.BaseCurrency, "targets", strings.Join(s.config.TargetCurrencies, ","), "upserted", result.Upserted, "synced_rate_dates", result.RateDates)
			return
		}

		s.logger.Error("exchange rate sync failed", "trigger", trigger, "rate_date", rateDate.Format("2006-01-02"), "base_currency", s.config.BaseCurrency, "targets", strings.Join(s.config.TargetCurrencies, ","), "error", err, "retry_in", syncRetryInterval.String())

		timer := time.NewTimer(syncRetryInterval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}

func parseDailyRunAt(value string) (int, int, error) {
	parsed, err := time.Parse("15:04", strings.TrimSpace(value))
	if err != nil {
		return 0, 0, fmt.Errorf("daily_run_at must use HH:MM: %w", err)
	}
	return parsed.Hour(), parsed.Minute(), nil
}

func nextRunAt(now time.Time, location *time.Location, hour int, minute int) time.Time {
	localNow := now.In(location)
	next := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), hour, minute, 0, 0, location)
	if !next.After(localNow) {
		next = next.AddDate(0, 0, 1)
	}
	return next
}
