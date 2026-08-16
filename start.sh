#!/bin/bash
# Start the A2UI Restaurant Finder (server + chosen client)
# Usage: ./start.sh [react|lit]
#
# Prerequisites:
#   1. pnpm install   (at the repo root)
#   2. Copy packages/server/.env.example to packages/server/.env and set your API key

set -e

PKG_DIR="$(cd "$(dirname "$0")" && pwd)/packages"
CLIENT_CHOICE="${1:-react}"

echo "Starting A2UI Restaurant Finder (${CLIENT_CHOICE} client)..."
echo ""

# Start server in background
echo "[1/2] Starting backend server (port 10002)..."
cd "$PKG_DIR/server"
pnpm exec tsx src/index.ts &
SERVER_PID=$!

# Wait for server to be ready
sleep 2

# Start chosen client
if [ "$CLIENT_CHOICE" = "lit" ]; then
  echo "[2/2] Starting Lit client (port 5004)..."
  cd "$PKG_DIR/client-lit"
  pnpm exec vite &
  CLIENT_PID=$!
  CLIENT_URL="http://localhost:5004"
else
  echo "[2/2] Starting React client (port 5003)..."
  cd "$PKG_DIR/client"
  pnpm exec vite &
  CLIENT_PID=$!
  CLIENT_URL="http://localhost:5003"
fi

echo ""
echo "Server:  http://localhost:10002"
echo "Client:  $CLIENT_URL"
echo ""
echo "Press Ctrl+C to stop both."

# Trap Ctrl+C to kill both
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM
wait
