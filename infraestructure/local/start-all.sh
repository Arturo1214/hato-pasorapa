#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  trap - INT TERM EXIT
  if [ -n "${BE_PID:-}" ]; then kill "${BE_PID}" 2>/dev/null || true; fi
  if [ -n "${FE_PID:-}" ]; then kill "${FE_PID}" 2>/dev/null || true; fi
}

trap cleanup INT TERM EXIT

bash "${SCRIPT_DIR}/start-be.sh" &
BE_PID=$!

bash "${SCRIPT_DIR}/start-fe.sh" &
FE_PID=$!

wait "${BE_PID}" "${FE_PID}"
