#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

uvicorn server.main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT

until curl -sf http://localhost:8000/health > /dev/null 2>&1; do
  sleep 0.3
done

chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-session-crashed-bubble \
  --autoplay-policy=no-user-gesture-required \
  "http://localhost:8000/static/player/index.html"
