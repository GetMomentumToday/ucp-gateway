#!/usr/bin/env bash
set -euo pipefail

##
# Seed products in Shopware via Admin API for E2E testing.
#
# Usage:
#   bash tests/e2e-shopware/seed-products.sh
#
# Prerequisites:
#   Shopware running with admin API accessible
##

SHOPWARE_URL="${SHOPWARE_URL:-http://localhost:8888}"

# ── Get admin token ──────────────────────────────────────────────────────
TOKEN_RESP=$(curl -s -X POST "${SHOPWARE_URL}/api/oauth/token" \
  -H 'Content-Type: application/json' \
  -d '{
    "grant_type": "password",
    "client_id": "administration",
    "username": "admin",
    "password": "shopware"
  }')
ADMIN_TOKEN=$(echo "$TOKEN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: Failed to get admin token for seeding products."
  exit 1
fi

AUTH="Authorization: Bearer ${ADMIN_TOKEN}"

# ── Get default tax ID ───────────────────────────────────────────────────
echo "Getting default tax ID..."
TAX_ID=$(curl -s "${SHOPWARE_URL}/api/tax" \
  -H "$AUTH" -H 'Accept: application/json' \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
elements=d.get('data',[])
if elements:
  print(elements[0].get('id',''))
else:
  print('')
" 2>/dev/null || true)

if [ -z "$TAX_ID" ]; then
  echo "ERROR: Could not find default tax ID."
  exit 1
fi
echo "  Tax ID: $TAX_ID"

# ── Get default currency ID ──────────────────────────────────────────────
CURRENCY_ID="b7d2554b0ce847cd82f3ac9bd1c0dfca"
echo "  Currency ID: $CURRENCY_ID (Shopware Defaults::CURRENCY)"

SALES_CHANNEL_ID=$(curl -s "${SHOPWARE_URL}/api/sales-channel" \
  -H "$AUTH" -H 'Accept: application/json' \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
for sc in d.get('data',[]):
  if sc.get('name','') == 'Storefront':
    print(sc['id']); break
else:
  if d.get('data'): print(d['data'][0]['id'])
" 2>/dev/null || true)

if [ -z "$SALES_CHANNEL_ID" ]; then
  echo "ERROR: Could not find sales channel ID."
  exit 1
fi
echo "  Sales Channel ID: $SALES_CHANNEL_ID"

create_product() {
  local name="$1" number="$2" price="$3" stock="$4"

  echo "Creating product: $name (SKU: $number, price: $price)..."

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SHOPWARE_URL}/api/product" \
    -H "$AUTH" \
    -H 'Content-Type: application/json' \
    -d "{
      \"name\": \"$name\",
      \"productNumber\": \"$number\",
      \"stock\": $stock,
      \"taxId\": \"$TAX_ID\",
      \"price\": [{
        \"currencyId\": \"$CURRENCY_ID\",
        \"gross\": $price,
        \"net\": $price,
        \"linked\": false
      }],
      \"active\": true,
      \"visibilities\": [{
        \"salesChannelId\": \"$SALES_CHANNEL_ID\",
        \"visibility\": 30
      }]
    }")

  if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "  Created."
  elif [ "$HTTP_CODE" = "400" ]; then
    echo "  Already exists or validation error (HTTP $HTTP_CODE) — skipping."
  else
    echo "  HTTP $HTTP_CODE — may already exist, continuing."
  fi
}

echo ""
echo "=== Seeding 5 test products ==="

create_product "UCP Test Shoes"     "UCP-SHOES-001"   49.99 100
create_product "UCP Test Jacket"    "UCP-JACKET-001"  89.99 50
create_product "UCP Test Hat"       "UCP-HAT-001"     19.99 200
create_product "UCP Test Pants"     "UCP-PANTS-001"   59.99 75
create_product "UCP Test Sneakers"  "UCP-SNEAK-001"   129.99 30

echo ""
echo "=== Products seeded ==="
