#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "🌌 [AetherDesk] 启动系统态势驾驶舱..."

# Check if client/dist exists, if not build it
if [ ! -d "client/dist" ]; then
  echo "📦 构建前端应用中..."
  pnpm --filter client build
fi

PORT="${PORT:-3001}"
echo "🚀 正在运行服务于: http://localhost:${PORT}"
echo "📡 WebSocket 遥测: ws://localhost:${PORT}/ws"
echo "🎣 Webhook 捕获: http://localhost:${PORT}/api/webhooks/catch/my-service"
echo ""

exec node server/index.js
