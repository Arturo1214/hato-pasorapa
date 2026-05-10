#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${PROJECT_ROOT}"

if command -v nvm >/dev/null 2>&1; then
  nvm use
elif [ -s "${HOME}/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "${HOME}/.nvm/nvm.sh"
  nvm use
fi

cd "${PROJECT_ROOT}/hato-fe"

npm start -- --proxy-config ../infraestructure/local/proxy.conf.json --host 0.0.0.0 --port 4200
