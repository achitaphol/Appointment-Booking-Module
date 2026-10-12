#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! docker compose version >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Docker and Docker Compose must be installed and running." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Review credentials before using this outside local development."
fi

if ! grep -Eq '^JWT_SECRET=.+$' .env; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "OpenSSL is required to generate JWT_SECRET." >&2
    exit 1
  fi

  jwt_secret="$(openssl rand -hex 32)"
  if grep -q '^JWT_SECRET=' .env; then
    sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=${jwt_secret}/" .env
    rm -f .env.bak
  else
    printf '\nJWT_SECRET=%s\n' "$jwt_secret" >> .env
  fi
  echo "Generated a local JWT signing secret in .env."
fi

if ! grep -Eq '^JWT_SECRET=.{32,}$' .env; then
  echo "JWT_SECRET in .env must contain at least 32 characters." >&2
  exit 1
fi

docker compose build frontend backend backend-tools
docker compose up -d --wait database redis
docker compose run --rm backend-tools pnpm exec prisma migrate deploy
docker compose run --rm backend-tools pnpm exec prisma db seed
docker compose up -d --wait backend frontend

echo "Initial setup complete. Run 'docker compose ps' to see the configured ports."
