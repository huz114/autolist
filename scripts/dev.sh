#!/bin/bash
# Quick dev server start (no watchdog)
# Usage: ./scripts/dev.sh [port]

PORT=${1:-4001}

echo "Starting Shiryolog dev server on port $PORT..."
lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null
rm -rf .next
npx next dev -p $PORT
