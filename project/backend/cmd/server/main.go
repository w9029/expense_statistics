package main

import (
	"context"
	"flag"
	"log"

	httpRouter "expense-statistics-server/internal/http/router"
	"expense-statistics-server/internal/modules/exchange"
	"expense-statistics-server/internal/modules/scheduler"
	"expense-statistics-server/internal/platform/clock"
	"expense-statistics-server/internal/platform/config"
	"expense-statistics-server/internal/platform/db"
	platformLogger "expense-statistics-server/internal/platform/logger"
)

func main() {
	configPath := flag.String("config", "internal/platform/config/config.dev.yaml", "path to config yaml file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	logger := platformLogger.New(cfg.Env)
	database, err := db.Open(cfg.DB)
	if err != nil {
		logger.Error("open database failed", "error", err)
		log.Fatalf("open database: %v", err)
	}
	defer func() {
		if closeErr := database.Close(); closeErr != nil {
			logger.Error("close database failed", "error", closeErr)
		}
	}()

	appClock := clock.NewRealClock()
	exchangeService := exchange.NewService(exchange.Deps{
		Repo:   exchange.NewRepository(database),
		Config: cfg.Exchange,
	})
	schedulerService := scheduler.NewService(scheduler.Deps{
		Logger:   logger,
		Clock:    appClock,
		Exchange: exchangeService,
		Config:   cfg.Exchange.Scheduler,
	})
	schedulerCtx, schedulerCancel := context.WithCancel(context.Background())
	defer schedulerCancel()
	schedulerService.Start(schedulerCtx)

	engine := httpRouter.New(httpRouter.Deps{
		Config: cfg,
		Logger: logger,
		DB:     database,
		Clock:  appClock,
	})

	addr := ":" + cfg.ServerPort
	logger.Info("server starting", "addr", addr, "env", cfg.Env, "config_path", *configPath)

	if err := engine.Run(addr); err != nil {
		logger.Error("server stopped", "error", err)
		log.Fatalf("run server: %v", err)
	}
}
