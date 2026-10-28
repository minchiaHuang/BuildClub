#!/usr/bin/env bash
# Throwaway Trend Finder backend for UI testing. Cannot spend money: no .env, all budgets 0.
# Usage: bash bin/isolated-backend.sh <port> [jobs_source_dir]   (runs in foreground; Ctrl-C or kill <pid> cleans up)
set -eu
cd "$(dirname "$0")/.."

port="${1:-}"; jobs_src="${2:-}"
[ -n "$port" ] || { echo "usage: bash bin/isolated-backend.sh <port> [jobs_source_dir]" >&2; exit 2; }
case "$port" in 8787|5195) echo "error: port $port is reserved (demo backend / video recording server)" >&2; exit 2;; esac
if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "error: port $port is already in use" >&2; exit 2; fi

TF=pivots/02-content/app/trend-finder
[ -d "$TF/dist" ] || { echo "error: $TF/dist is missing; run 'npm run build' in $TF first" >&2; exit 1; }
[ -z "$jobs_src" ] || [ -d "$jobs_src" ] || { echo "error: jobs_source_dir not found: $jobs_src" >&2; exit 1; }
venv="${TF_VENV:-/Users/tommy/Desktop/BuildClub/$TF/backend/.venv}"
[ -x "$venv/bin/uvicorn" ] || { echo "error: no uvicorn in $venv (set TF_VENV)" >&2; exit 1; }

tmp="$(mktemp -d)"
pid=""
cleanup() { [ -z "$pid" ] || kill "$pid" 2>/dev/null || true; rm -r -f "$tmp"; }
trap cleanup EXIT
trap 'exit 143' INT TERM

# Copy the backend without local state or secrets; the backend reads ../.env, so none may exist.
mkdir "$tmp/backend"
rsync -a --exclude .venv --exclude data.db --exclude cache --exclude jobs --exclude __pycache__ \
  --exclude .env "$TF/backend/" "$tmp/backend/"
cp -R "$TF/dist" "$tmp/dist"
[ -z "$jobs_src" ] || cp -R "$jobs_src" "$tmp/backend/jobs"
rm -f "$tmp/.env" "$tmp/backend/.env"

# Clean environment, dummy token, zero budgets: any paid call is rejected before it happens.
cd "$tmp"
env -i HOME="$HOME" PATH="$PATH" \
  APIFY_TOKEN=dummy DAILY_APIFY_USD=0 DAILY_CLAUDE_USD=0 DAILY_JEV_USD=0 DAILY_SCRAPECREATORS_CREDITS=0 \
  "$venv/bin/uvicorn" server:app --app-dir backend --port "$port" >"$tmp/server.log" 2>&1 &
pid=$!
echo "temp dir: $tmp"; echo "url:      http://127.0.0.1:$port"; echo "pid:      $pid  (kill $pid to stop)"

for _ in $(seq 1 60); do
  if out="$(curl -fsS "http://127.0.0.1:$port/api/health" 2>/dev/null)"; then echo "health:   $out"; wait "$pid"; exit $?; fi
  kill -0 "$pid" 2>/dev/null || { echo "error: server exited early:" >&2; tail -20 "$tmp/server.log" >&2; exit 1; }
  sleep 0.5
done
echo "error: /api/health did not answer in 30s" >&2; exit 1
