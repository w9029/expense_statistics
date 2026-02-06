package main

import (
    "log"
    "expense-statistics-server/internal/config"
    "expense-statistics-server/internal/router"
)

func main() {
    // 1. 加载配置
    cfg, err := config.LoadConfig()
    if err != nil {
        log.Fatalf("failed to load config: %v", err)
    }

    // 2. 初始化数据库
    if err := config.InitDB(cfg); err != nil {
        log.Fatalf("failed to init db: %v", err)
    }

    // 3. 初始化路由
    r := router.SetupRouter()

    // 4. 启动服务器
    log.Printf("server running on port %s", cfg.ServerPort)
    if err := r.Run(":" + cfg.ServerPort); err != nil {
        log.Fatalf("failed to run server: %v", err)
    }
}
