#!/usr/bin/env bash
# Throwaway Trend Finder backend for UI testing. Cannot spend money: no .env, all budgets 0.
# Usage: bash bin/isolated-backend.sh <port> [jobs_source_dir] [--demo-data] [--user <email>:<password>]
#   (runs in foreground; Ctrl-C or kill <pid> cleans up)
#   --demo-data  also copy the finished breakdowns (jobs/<id>/) of the pinned searches' videos, found in
#                jobs_source_dir, this checkout's backend/jobs, or the same folder of a sibling worktree
#   --user       create a sign-in account once the server answers
set -eu
cd "$(dirname "$0")/.."

usage="usage: bash bin/isolated-backend.sh <port> [jobs_source_dir] [--demo-data] [--user <email>:<password>]"
port="${1:-}"; jobs_src=""; demo=0; user=""
[ -n "$port" ] || { echo "$usage" >&2; exit 2; }
shift
if [ "$#" -gt 0 ] && [ "${1#--}" = "$1" ]; then jobs_src="$1"; shift; fi
while [ "$#" -gt 0 ]; do
  case "$1" in
    --demo-data) demo=1; shift;;
    --user) [ "$#" -ge 2 ] || { echo "$usage" >&2; exit 2; }; user="$2"; shift 2;;
    *) echo "$usage" >&2; exit 2;;
  esac
done
case "$user" in ""|*:*) ;; *) echo "error: --user needs <email>:<password>" >&2; exit 2;; esac
case "$port" in 8787|5195) echo "error: port $port is reserved (demo backend / video recording server)" >&2; exit 2;; esac
if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "error: port $port is already in use" >&2; exit 2; fi

TF=pivots/02-content/app/trend-finder
[ -d "$TF/dist" ] || { echo "error: $TF/dist is missing; run 'npm run build' in $TF first" >&2; exit 1; }
[ -z "$jobs_src" ] || [ -d "$jobs_src" ] || { echo "error: jobs_source_dir not found: $jobs_src" >&2; exit 1; }
venv="${TF_VENV:-/Users/tommy/Desktop/BuildClub/$TF/backend/.venv}"
[ -x "$venv/bin/uvicorn" ] || { echo "error: no uvicorn in $venv (set TF_VENV)" >&2; exit 1; }

tmp="$(mktemp -d)"
pid=""
cleanup() { [ -z "$pid" ] || kill "$pid" 2>/dev/null || true; rm -r "$tmp"; }
trap cleanup EXIT
trap 'exit 143' INT TERM

# Copy the backend without local state or secrets; the backend reads ../.env, so none may exist.
mkdir "$tmp/backend"
rsync -a --exclude .venv --exclude data.db --exclude cache --exclude jobs --exclude __pycache__ \
  --exclude .env "$TF/backend/" "$tmp/backend/"
cp -R "$TF/dist" "$tmp/dist"
[ -z "$jobs_src" ] || cp -R "$jobs_src" "$tmp/backend/jobs"
if [ "$demo" = 1 ]; then
  # pinned/ came with the rsync; add the breakdown folder of every pinned video that has one.
  mkdir -p "$tmp/backend/jobs"
  ids="$("$venv/bin/python" - "$tmp/backend" <<'PY'
import glob, json, sys
sys.path.insert(0, sys.argv[1])
from analyze import job_id_for
for f in glob.glob(sys.argv[1] + "/pinned/*.json"):
    for v in json.load(open(f)).get("videos", []):
        print(job_id_for(v["url"]))
PY
)"
  for src in "$jobs_src" "$TF/backend/jobs" /Users/tommy/Desktop/BuildClub/$TF/backend/jobs ../*/$TF/backend/jobs; do
    [ -n "$src" ] && [ -d "$src" ] || continue
    for id in $ids; do
      [ -f "$src/$id/breakdown.json" ] && [ ! -e "$tmp/backend/jobs/$id" ] && cp -R "$src/$id" "$tmp/backend/jobs/$id"
    done
  done
  echo "demo data: $(ls "$tmp/backend/jobs" | wc -l | tr -d ' ') breakdowns, $(ls "$tmp/backend/pinned" | wc -l | tr -d ' ') pinned searches"
fi
rm -f "$tmp/.env" "$tmp/backend/.env"

# Clean environment, dummy token, zero budgets: any paid call is rejected before it happens.
cd "$tmp"
clean_env=(env -i HOME="$HOME" PATH="$PATH"
  APIFY_TOKEN=dummy DAILY_APIFY_USD=0 DAILY_CLAUDE_USD=0 DAILY_JEV_USD=0 DAILY_SCRAPECREATORS_CREDITS=0)
"${clean_env[@]}" "$venv/bin/uvicorn" server:app --app-dir backend --port "$port" >"$tmp/server.log" 2>&1 &
pid=$!
echo "temp dir: $tmp"; echo "url:      http://127.0.0.1:$port"; echo "pid:      $pid  (kill $pid to stop)"

for _ in $(seq 1 60); do
  if out="$(curl -fsS "http://127.0.0.1:$port/api/health" 2>/dev/null)"; then echo "health:   $out"
    if [ -n "$user" ]; then
      printf '%s\n' "${user#*:}" | "${clean_env[@]}" "$venv/bin/python" backend/server.py add-user "${user%%:*}" "E2E Tester" "E2E Agency" --password-stdin
    fi
    wait "$pid"; exit $?; fi
  kill -0 "$pid" 2>/dev/null || { echo "error: server exited early:" >&2; tail -20 "$tmp/server.log" >&2; exit 1; }
  sleep 0.5
done
echo "error: /api/health did not answer in 30s" >&2; exit 1
