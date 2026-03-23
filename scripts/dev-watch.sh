#!/bin/bash
# Shiryolog Dev Server Watchdog
# Usage: ./scripts/dev-watch.sh [port]
# Stop: Ctrl+C or kill the watchdog process

PORT=${1:-4001}
CHECK_INTERVAL=30  # seconds between health checks
MAX_FAILURES=1     # consecutive failures before restart
STARTUP_WAIT=15    # seconds to wait after starting server

failure_count=0
server_pid=""

cleanup() {
  echo "[watchdog] Shutting down..."
  if [ -n "$server_pid" ]; then
    kill $server_pid 2>/dev/null
    wait $server_pid 2>/dev/null
  fi
  # Also kill any process on the port
  lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null
  echo "[watchdog] Stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM

start_server() {
  echo "[watchdog] Starting dev server on port $PORT..."
  # Kill any existing process on the port
  lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null
  sleep 1
  # Clear .next cache
  rm -rf .next
  # Start the server
  npx next dev -p $PORT > /tmp/shiryolog-dev-$PORT.log 2>&1 &
  server_pid=$!
  echo "[watchdog] Server PID: $server_pid"
  echo "[watchdog] Waiting ${STARTUP_WAIT}s for startup..."
  sleep $STARTUP_WAIT
  failure_count=0
}

check_health() {
  # Check if process is alive
  if ! kill -0 $server_pid 2>/dev/null; then
    echo "[watchdog] Server process died!"
    return 1
  fi
  # Check if HTTP responds with valid content (not just 200)
  local response
  response=$(curl -s --max-time 10 http://localhost:$PORT/ 2>/dev/null)
  if [ $? -ne 0 ]; then
    echo "[watchdog] Server not responding on port $PORT"
    return 1
  fi
  # Check for module resolution errors in response
  if echo "$response" | grep -q "Cannot find module"; then
    echo "[watchdog] Module error detected, forcing restart..."
    return 1
  fi
  return 0
}

echo "============================================"
echo "  Shiryolog Dev Server Watchdog"
echo "  Port: $PORT"
echo "  Health check: every ${CHECK_INTERVAL}s"
echo "  Restart after: ${MAX_FAILURES} failures"
echo "  Stop: Ctrl+C"
echo "============================================"

# Initial start
start_server

# Main loop
while true; do
  sleep $CHECK_INTERVAL

  if check_health; then
    failure_count=0
  else
    failure_count=$((failure_count + 1))
    echo "[watchdog] Health check failed ($failure_count/$MAX_FAILURES)"

    if [ $failure_count -ge $MAX_FAILURES ]; then
      echo "[watchdog] Max failures reached. Restarting server..."
      start_server
    fi
  fi
done
