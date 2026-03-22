package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"expense-statistics-server/internal/platform/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Database struct {
	Gorm *gorm.DB
	SQL  *sql.DB
}

func Open(cfg config.DBConfig) (*Database, error) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%d sslmode=%s TimeZone=%s",
		cfg.Host,
		cfg.User,
		cfg.Password,
		cfg.Name,
		cfg.Port,
		cfg.SSLMode,
		cfg.TimeZone,
	)

	gormDB, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("connect with gorm: %w", err)
	}

	sqlDB, err := gormDB.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql db: %w", err)
	}

	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetMaxOpenConns(20)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &Database{
		Gorm: gormDB,
		SQL:  sqlDB,
	}, nil
}

func (d *Database) Close() error {
	if d == nil || d.SQL == nil {
		return nil
	}
	return d.SQL.Close()
}

func (d *Database) Ping(ctx context.Context) error {
	if d == nil || d.SQL == nil {
		return fmt.Errorf("database is not initialized")
	}
	return d.SQL.PingContext(ctx)
}

func (d *Database) CurrentDate(ctx context.Context) (time.Time, error) {
	if d == nil || d.Gorm == nil {
		return time.Time{}, fmt.Errorf("database is not initialized")
	}

	var currentDate time.Time
	if err := d.Gorm.WithContext(ctx).Raw("SELECT CURRENT_DATE").Scan(&currentDate).Error; err != nil {
		return time.Time{}, fmt.Errorf("query current date: %w", err)
	}

	return currentDate, nil
}
