package config

import (
    "fmt"
    "io/ioutil"

    "gorm.io/gorm"
    "gorm.io/driver/postgres"
    "gopkg.in/yaml.v2"
)

type Config struct {
    ServerPort string `yaml:"server_port"`
    DB         DBConfig
    JWTSecret  string `yaml:"jwt_secret"`
}

type DBConfig struct {
    Host     string `yaml:"host"`
    Port     int    `yaml:"port"`
    User     string `yaml:"user"`
    Password string `yaml:"password"`
    Name     string `yaml:"name"`
}

var Cfg *Config
var DB *gorm.DB

func LoadConfig() (*Config, error) {
    file, err := ioutil.ReadFile("internal/config/config.yaml")
    if err != nil {
        return nil, fmt.Errorf("read config.yaml failed: %v", err)
    }

    var cfg Config
    if err := yaml.Unmarshal(file, &cfg); err != nil {
        return nil, fmt.Errorf("unmarshal config.yaml failed: %v", err)
    }

    Cfg = &cfg
    return &cfg, nil
}

func InitDB(cfg *Config) error {
    dsn := fmt.Sprintf(
        "host=%s user=%s password=%s dbname=%s port=%d sslmode=disable TimeZone=Asia/Shanghai",
        cfg.DB.Host,
        cfg.DB.User,
        cfg.DB.Password,
        cfg.DB.Name,
        cfg.DB.Port,
    )

    var err error
    DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
    if err != nil {
        return fmt.Errorf("failed to connect to database: %v", err)
    }

    return nil
}
