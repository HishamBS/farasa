#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
if bun /app/migrate.ts; then
  echo "[entrypoint] Migrations applied successfully."
else
  echo "[entrypoint] Migration failed — starting app anyway (tables may already exist)."
fi

echo "[entrypoint] Starting application..."
exec bun server.js
