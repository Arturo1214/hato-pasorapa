#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

mkdir -p "${PROJECT_ROOT}/logs" "${PROJECT_ROOT}/images"

cd "${PROJECT_ROOT}/hato-be"

if command -v jenv >/dev/null 2>&1; then
  jenv local 21.0.5 >/dev/null 2>&1 || true
fi

export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 21)}"
export PATH="${JAVA_HOME}/bin:${PATH}"

export HTTP_PORT="${HTTP_PORT:-8080}"
export DB_URL="${DB_URL:-jdbc:postgresql://localhost:5432/hato}"
export DB_USER="${DB_USER:-postgres}"
export DB_PASS="${DB_PASS:-postgres}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:4200,http://localhost:3000,http://localhost:5173}"

export QUARKUS_LOG_FILE_ENABLED="${QUARKUS_LOG_FILE_ENABLED:-true}"
export QUARKUS_LOG_FILE_PATH="${QUARKUS_LOG_FILE_PATH:-${PROJECT_ROOT}/logs/hato-be-local.log}"
export QUARKUS_LOG_CONSOLE_JSON_ENABLED="${QUARKUS_LOG_CONSOLE_JSON_ENABLED:-false}"
export QUARKUS_LOG_FILE_JSON_ENABLED="${QUARKUS_LOG_FILE_JSON_ENABLED:-false}"

export HATO_STORAGE_ANIMAL_IMAGES_ROOT_DIR="${HATO_STORAGE_ANIMAL_IMAGES_ROOT_DIR:-${PROJECT_ROOT}/images}"

./mvnw quarkus:dev
