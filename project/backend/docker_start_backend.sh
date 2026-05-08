#!/bin/sh
set -eu

cd /app
chmod +x /app/server
exec /app/server -config /app/internal/platform/config/config.prod.yaml
