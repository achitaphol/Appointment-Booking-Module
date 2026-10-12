#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! docker compose version >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Docker and Docker Compose must be installed and running." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing .env. Run ./init.sh for first-time setup." >&2
  exit 1
fi

if ! grep -Eq '^JWT_SECRET=.{32,}$' .env; then
  echo "JWT_SECRET is missing or too short in .env. Run ./init.sh for first-time setup." >&2
  exit 1
fi

docker compose build frontend backend backend-tools
docker compose up -d --wait database redis
docker compose run --rm backend-tools pnpm exec prisma migrate deploy
docker compose up -d --wait backend frontend

echo "Deployment complete. Existing PostgreSQL and Redis volumes were preserved."
