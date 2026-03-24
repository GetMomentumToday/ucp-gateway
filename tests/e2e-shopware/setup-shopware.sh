#!/usr/bin/env bash
set -euo pipefail

##
# Set up Shopware (dockware) for E2E testing.
# Waits for health check, obtains admin token, retrieves sales channel access key.
#
# Usage:
#   bash tests/e2e-shopware/setup-shopware.sh
#
# Prerequisites:
#   dockware/dev:6.6.4.1 running on SHOPWARE_URL
##

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SHOPWARE_URL="${SHOPWARE_URL:-http://localhost:8888}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-300}"

echo "=== Shopware E2E Setup ==="
echo "Shopware URL: $SHOPWARE_URL"
echo ""

# ── 1. Wait for Shopware health check ─────────────────────────────────────
echo "1. Waiting for Shopware health check (max ${MAX_WAIT_SECONDS}s)..."
elapsed=0
while [ "$elapsed" -lt "$MAX_WAIT_SECONDS" ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SHOPWARE_URL}/api/_info/health-check" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "   Health check OK after ${elapsed}s."
    break
  fi
  sleep 5
  elapsed=$((elapsed + 5))
  if [ $((elapsed % 30)) -eq 0 ]; then
    echo "   Still waiting... (${elapsed}s)"
  fi
done

if [ "$elapsed" -ge "$MAX_WAIT_SECONDS" ]; then
  echo "ERROR: Shopware did not become healthy within ${MAX_WAIT_SECONDS}s."
  exit 1
fi

# ── 2. Get admin OAuth token ──────────────────────────────────────────────
echo "2. Getting admin API token via OAuth..."
ADMIN_TOKEN=""
for attempt in 1 2 3 4 5; do
  TOKEN_RESP=$(curl -s -X POST "${SHOPWARE_URL}/api/oauth/token" \
    -H 'Content-Type: application/json' \
    -d '{
      "grant_type": "password",
      "client_id": "administration",
      "username": "admin",
      "password": "shopware"
    }' || true)
  ADMIN_TOKEN=$(echo "$TOKEN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
  if [ -n "$ADMIN_TOKEN" ]; then
    echo "   Admin token obtained."
    break
  fi
  echo "   Attempt $attempt failed, retrying..."
  sleep 5
done

if [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: Failed to get admin OAuth token."
  exit 1
fi

# ── 3. Get sales channel access key ──────────────────────────────────────
echo "3. Retrieving sales channel access key..."
ACCESS_KEY=$(curl -s "${SHOPWARE_URL}/api/sales-channel" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H 'Accept: application/json' \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
elements=d.get('data',[])
if elements:
  print(elements[0].get('accessKey',''))
else:
  print('')
" 2>/dev/null || true)

if [ -z "$ACCESS_KEY" ]; then
  echo "   No sales channel found via API, using default access key."
  ACCESS_KEY="SWSCZHNVCVDZCK5SCDNRBJJ3UW"
fi

echo "   Access key: $ACCESS_KEY"
echo "$ACCESS_KEY" > "$SCRIPT_DIR/.shopware-access-key"

# ── 4. Seed products ─────────────────────────────────────────────────────
echo "4. Seeding products..."
bash "$SCRIPT_DIR/seed-products.sh"

echo ""
echo "=== Shopware setup complete ==="
echo "Access key saved to $SCRIPT_DIR/.shopware-access-key"
