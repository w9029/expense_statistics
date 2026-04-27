package main

import (
	"flag"
	"log"

	httpRouter "expense-statistics-server/internal/http/router"
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

	engine := httpRouter.New(httpRouter.Deps{
		Config: cfg,
		Logger: logger,
		DB:     database,
		Clock:  clock.NewRealClock(),
	})

	addr := ":" + cfg.ServerPort
	logger.Info("server starting", "addr", addr, "env", cfg.Env, "config_path", *configPath)

	if err := engine.Run(addr); err != nil {
		logger.Error("server stopped", "error", err)
		log.Fatalf("run server: %v", err)
	}
}
