#!/usr/bin/env bash
# AetherDesk Daemon Controller (start / stop / restart / status / logs)

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

PID_FILE="$DIR/data/aetherdesk.pid"
LOG_FILE="$DIR/data/aetherdesk.log"
mkdir -p "$DIR/data"

case "$1" in
  start)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "⚠️  AetherDesk 已经在运行中 (PID: $(cat "$PID_FILE"))"
      echo "🌐 访问地址: http://localhost:3001"
      exit 0
    fi

    # Ensure client build exists
    if [ ! -d "$DIR/client/dist" ]; then
      echo "📦 正在初次编译前端资源..."
      pnpm --filter client build
    fi

    nohup node "$DIR/server/index.js" > "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    sleep 1

    if kill -0 "$PID" 2>/dev/null; then
      echo "🚀 AetherDesk 已在后台启动 (PID: $PID)"
      echo "🌐 访问地址: http://localhost:3001"
      echo "📄 日志文件: $LOG_FILE"
    else
      echo "❌ 启动失败，请检查日志: $LOG_FILE"
      cat "$LOG_FILE"
      exit 1
    fi
    ;;

  stop)
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if kill -0 "$PID" 2>/dev/null; then
        echo "🛑 正在停止 AetherDesk (PID: $PID)..."
        kill "$PID"
        rm -f "$PID_FILE"
        echo "✅ AetherDesk 已安全退出。"
      else
        echo "⚠️  进程未运行，清除残留 PID 文件。"
        rm -f "$PID_FILE"
      fi
    else
      # Also check port 3001
      PID=$(lsof -t -i:3001 2>/dev/null || true)
      if [ -n "$PID" ]; then
        kill "$PID"
        echo "✅ 已终止占用 3001 端口的进程 (PID: $PID)。"
      else
        echo "AetherDesk 未在运行。"
      fi
    fi
    ;;

  status)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "🟢 AetherDesk 运行正常 (PID: $(cat "$PID_FILE"))"
      echo "🌐 仪表盘: http://localhost:3001"
    else
      echo "🔴 AetherDesk 未在运行"
    fi
    ;;

  restart)
    "$0" stop
    sleep 1
    "$0" start
    ;;

  logs)
    tail -n 50 -f "$LOG_FILE"
    ;;

  *)
    echo "用法: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
