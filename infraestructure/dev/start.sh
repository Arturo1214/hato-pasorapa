#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
EXAMPLE_FILE="$SCRIPT_DIR/.env.example"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

usage() {
  printf 'Uso: %s [up|down|logs|ps|reset-db|reset|help]\n' "$0"
  printf '  up        Levanta/reconstruye servicios en segundo plano\n'
  printf '  down      Baja servicios sin borrar volúmenes\n'
  printf '  logs      Sigue logs del compose\n'
  printf '  ps        Muestra estado de servicios\n'
  printf '  reset-db  Baja servicios y BORRA el volumen de PostgreSQL dev\n'
  printf '            Requiere confirmación interactiva o CONFIRM_RESET=yes\n'
  printf '  reset     Alias de reset-db\n'
  printf '  help      Muestra esta ayuda\n'
}

confirm_reset() {
  if [[ "${CONFIRM_RESET:-no}" == "yes" ]]; then
    return 0
  fi

  if [[ ! -t 0 ]]; then
    printf 'Reset cancelado. Ejecutá otra vez con CONFIRM_RESET=yes para borrar los datos dev.\n' >&2
    exit 1
  fi

  printf 'ADVERTENCIA: esto va a borrar el volumen PostgreSQL de desarrollo y TODOS los datos dev.\n' >&2
  printf 'No toca el bind mount de imágenes (%s).\n' "$HATO_IMAGES_HOST_PATH" >&2
  printf 'Escribí RESET-DEV-DB para continuar: ' >&2

  local confirmation
  read -r confirmation

  if [[ "$confirmation" != "RESET-DEV-DB" ]]; then
    printf 'Reset cancelado.\n' >&2
    exit 1
  fi
}

if ! command -v docker >/dev/null 2>&1; then
  printf 'docker no está instalado o no está en PATH.\n' >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  printf 'Docker daemon no está corriendo. Iniciá Docker Desktop o el servicio de Docker y probá de nuevo.\n' >&2
  exit 1
fi

export PROJECT_ROOT

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  printf 'Se creó %s a partir de .env.example\n' "$ENV_FILE"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

HATO_IMAGES_HOST_PATH="${HATO_IMAGES_HOST_PATH:-$PROJECT_ROOT/images}"

if [[ "$HATO_IMAGES_HOST_PATH" != /* ]]; then
  HATO_IMAGES_HOST_PATH="$PROJECT_ROOT/$HATO_IMAGES_HOST_PATH"
fi

export HATO_IMAGES_HOST_PATH

mkdir -p "$HATO_IMAGES_HOST_PATH"

case "${1:-up}" in
  up)
    compose up --build -d
    printf '\nServicios levantados.\n'
    printf 'FE/Nginx:  http://localhost:%s\n' "${DEV_WEB_PORT:-8080}"
    printf 'BE directo: http://localhost:%s/q/health\n' "${DEV_API_PORT:-8081}"
    printf 'DB:        localhost:%s\n' "${DEV_DB_PORT:-5434}"
    printf 'Imágenes:  %s -> %s\n' "$HATO_IMAGES_HOST_PATH" "${HATO_STORAGE_ANIMAL_IMAGES_ROOT_DIR:-/work/storage/animal-images}"
    ;;
  down)
    compose down --remove-orphans
    ;;
  logs)
    compose logs -f
    ;;
  ps)
    compose ps
    ;;
  reset-db|reset)
    confirm_reset
    compose down --volumes --remove-orphans
    printf 'Volumen PostgreSQL dev eliminado.\n'
    printf 'Próximo paso: %s up\n' "$0"
    printf 'Importante: si Liquibase había fallado a mitad de un changeset, reintentá sobre esta base limpia.\n'
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
