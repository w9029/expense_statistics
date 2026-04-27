package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v2"
)

type Config struct {
	AppName    string         `yaml:"app_name"`
	Env        string         `yaml:"env"`
	ServerPort string         `yaml:"server_port"`
	JWTSecret  string         `yaml:"jwt_secret"`
	DB         DBConfig       `yaml:"db"`
	Mail       MailConfig     `yaml:"mail"`
	Exchange   ExchangeConfig `yaml:"exchange"`
}

type DBConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Name     string `yaml:"name"`
	SSLMode  string `yaml:"sslmode"`
	TimeZone string `yaml:"timezone"`
}

type MailConfig struct {
	From     string `yaml:"from"`
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
}

type ExchangeConfig struct {
	APIKey                string                  `yaml:"api_key"`
	HistoricalURL         string                  `yaml:"historical_url"`
	LatestURL             string                  `yaml:"latest_url"`
	RequestTimeoutSeconds int                     `yaml:"request_timeout_seconds"`
	Scheduler             ExchangeSchedulerConfig `yaml:"scheduler"`
}

type ExchangeSchedulerConfig struct {
	Enabled          bool     `yaml:"enabled"`
	TimeZone         string   `yaml:"timezone"`
	DailyRunAt       string   `yaml:"daily_run_at"`
	BaseCurrency     string   `yaml:"base_currency"`
	TargetCurrencies []string `yaml:"target_currencies"`
	StartupSync      bool     `yaml:"startup_sync"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config file: %w", err)
	}

	cfg.applyDefaults()
	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func (c *Config) applyDefaults() {
	if c.AppName == "" {
		c.AppName = "expense-statistics-server"
	}
	if c.Env == "" {
		c.Env = "development"
	}
	if c.ServerPort == "" {
		c.ServerPort = "8080"
	}
	if c.DB.SSLMode == "" {
		c.DB.SSLMode = "disable"
	}
	if c.DB.TimeZone == "" {
		c.DB.TimeZone = "Asia/Tokyo"
	}
	if c.Exchange.HistoricalURL == "" {
		c.Exchange.HistoricalURL = "https://api.currencyapi.com/v3/historical"
	}
	if c.Exchange.LatestURL == "" {
		c.Exchange.LatestURL = "https://api.currencyapi.com/v3/latest"
	}
	if c.Exchange.RequestTimeoutSeconds <= 0 {
		c.Exchange.RequestTimeoutSeconds = 15
	}
	if c.Exchange.Scheduler.TimeZone == "" {
		c.Exchange.Scheduler.TimeZone = c.DB.TimeZone
	}
	if c.Exchange.Scheduler.DailyRunAt == "" {
		c.Exchange.Scheduler.DailyRunAt = "00:00"
	}
	if c.Exchange.Scheduler.BaseCurrency == "" {
		c.Exchange.Scheduler.BaseCurrency = "JPY"
	}
	if len(c.Exchange.Scheduler.TargetCurrencies) == 0 {
		c.Exchange.Scheduler.TargetCurrencies = []string{"CNY", "USD"}
	}
}

func (c *Config) validate() error {
	if c.ServerPort == "" {
		return fmt.Errorf("server_port is required")
	}
	if c.JWTSecret == "" {
		return fmt.Errorf("jwt_secret is required")
	}
	if c.DB.Host == "" || c.DB.Port == 0 || c.DB.User == "" || c.DB.Name == "" {
		return fmt.Errorf("db config is incomplete")
	}
	return nil
}
