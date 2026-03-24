#!/usr/bin/env bash
set -euo pipefail

##
# Seed a Shopware tenant in the UCP Gateway database.
#
# Usage:
#   bash tests/e2e-shopware/seed-tenant.sh
#
# Prerequisites:
#   - Postgres running (docker-compose.dev.yml)
#   - Shopware access key in tests/e2e-shopware/.shopware-access-key
##

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SHOPWARE_URL="${SHOPWARE_URL:-http://localhost:8888}"
GATEWAY_PORT="${GATEWAY_PORT:-3000}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-ucp}"
DB_NAME="${DB_NAME:-ucp}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6380}"

ACCESS_KEY=""
if [ -f "$SCRIPT_DIR/.shopware-access-key" ]; then
  ACCESS_KEY=$(cat "$SCRIPT_DIR/.shopware-access-key" | tr -d '\n\r ')
fi

if [ -z "$ACCESS_KEY" ]; then
  ACCESS_KEY="${SHOPWARE_ACCESS_KEY:-SWSCZHNVCVDZCK5SCDNRBJJ3UW}"
fi

echo "=== Seeding Shopware tenant ==="
echo "Shopware URL: $SHOPWARE_URL"
echo "Access key: $ACCESS_KEY"
echo "Gateway port: $GATEWAY_PORT"
echo "DB: $DB_HOST:$DB_PORT"
echo ""

DB_CONTAINER="${DB_CONTAINER:-ucp-middleware-postgres-1}"

run_psql() {
  if command -v psql > /dev/null 2>&1; then
    PGPASSWORD="$DB_USER" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$1" 2>&1 | grep -v "^$"
  else
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$1" 2>&1 | grep -v "^$"
  fi
}

echo "1. Ensuring tenants table exists..."
run_psql "
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  platform VARCHAR(100) NOT NULL,
  adapter_config JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);"

echo "2. Upserting shopware-e2e tenant..."
run_psql "DELETE FROM tenants WHERE slug = 'shopware-e2e' OR domain = 'localhost:${GATEWAY_PORT}';"

TMPFILE=$(mktemp)
cat > "$TMPFILE" <<EOF
INSERT INTO tenants (slug, domain, platform, adapter_config)
VALUES ('shopware-e2e', 'localhost:${GATEWAY_PORT}', 'shopware',
  '{"storeUrl":"${SHOPWARE_URL}","accessKey":"${ACCESS_KEY}"}'::jsonb);
EOF
if command -v psql > /dev/null 2>&1; then
  PGPASSWORD="$DB_USER" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$TMPFILE" 2>&1 | grep -v "^$"
else
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$TMPFILE" 2>&1 | grep -v "^$"
fi
rm -f "$TMPFILE"

REDIS_CONTAINER="${REDIS_CONTAINER:-ucp-middleware-redis-1}"

echo "3. Flushing Redis cache..."
if command -v redis-cli > /dev/null 2>&1; then
  redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" FLUSHALL > /dev/null 2>&1 || true
else
  docker exec "$REDIS_CONTAINER" redis-cli FLUSHALL > /dev/null 2>&1 || true
fi

echo ""
echo "=== Tenant seeded ==="
echo "Domain: localhost:${GATEWAY_PORT} → Shopware at ${SHOPWARE_URL}"
