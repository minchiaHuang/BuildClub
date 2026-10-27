#!/usr/bin/env bash
# Project verification. Exits non-zero if any step fails.
set -u
cd "$(dirname "$0")/.."

fail=0
run_step() {
  local name="$1"; shift
  if "$@" >/tmp/verify_step.log 2>&1; then
    echo "PASS  $name"
  else
    echo "FAIL  $name"; sed 's/^/      /' /tmp/verify_step.log | tail -20
    fail=1
  fi
}

TF=pivots/02-content/app/trend-finder
run_step "trend-finder backend compiles" "$TF/backend/.venv/bin/python" -m py_compile "$TF/backend/server.py"
run_step "trend-finder backend loads" "$TF/backend/.venv/bin/python" -c "import sys; sys.path.insert(0, '$TF/backend'); import server"
run_step "trend-finder backend tests" "$TF/backend/.venv/bin/python" -m pytest -q -p no:cacheprovider "$TF/backend/tests"

[ "$fail" -eq 0 ] && echo "verify: GREEN" || echo "verify: RED"
exit "$fail"
