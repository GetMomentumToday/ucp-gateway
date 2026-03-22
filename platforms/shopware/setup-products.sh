#!/usr/bin/env bash
set -euo pipefail

##
# Create sample products in Shopware 6 via Admin API.
#
# Prerequisites:
#   docker compose -f platforms/docker-compose.platforms.yml up -d
#   Wait until Shopware is healthy (~2 min first boot)
#
# Usage:
#   bash platforms/shopware/setup-products.sh
##

SHOPWARE_URL="${SHOPWARE_URL:-http://localhost:8888}"
ADMIN_USER="${SHOPWARE_ADMIN_USER:-admin}"
ADMIN_PASS="${SHOPWARE_ADMIN_PASSWORD:-shopware}"

echo "==> Authenticating with Shopware at ${SHOPWARE_URL}..."
AUTH_RESPONSE=$(curl -s -X POST "${SHOPWARE_URL}/api/oauth/token" \
  -H 'Content-Type: application/json' \
  -d "{
    \"grant_type\": \"password\",
    \"client_id\": \"administration\",
    \"username\": \"${ADMIN_USER}\",
    \"password\": \"${ADMIN_PASS}\"
  }")

TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get admin token. Is Shopware running?"
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi
echo "    Token acquired."

AUTH="Authorization: Bearer ${TOKEN}"

# ── Get the default tax ID and sales channel ID ──────────────────────────
echo "==> Fetching default tax rate..."
TAX_ID=$(curl -s -X POST "${SHOPWARE_URL}/api/search/tax" \
  -H "${AUTH}" \
  -H 'Content-Type: application/json' \
  -d '{"limit": 1, "filter": [{"type": "equals", "field": "taxRate", "value": 19}]}' \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TAX_ID" ]; then
  # Fallback: get any tax
  TAX_ID=$(curl -s -X POST "${SHOPWARE_URL}/api/search/tax" \
    -H "${AUTH}" \
    -H 'Content-Type: application/json' \
    -d '{"limit": 1}' \
    | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
echo "    Tax ID: ${TAX_ID}"

echo "==> Fetching default currency ID..."
CURRENCY_ID=$(curl -s -X POST "${SHOPWARE_URL}/api/search/currency" \
  -H "${AUTH}" \
  -H 'Content-Type: application/json' \
  -d '{"limit": 1, "filter": [{"type": "equals", "field": "isoCode", "value": "EUR"}]}' \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "    Currency ID: ${CURRENCY_ID}"

echo "==> Fetching default sales channel..."
SALES_CHANNEL_ID=$(curl -s -X POST "${SHOPWARE_URL}/api/search/sales-channel" \
  -H "${AUTH}" \
  -H 'Content-Type: application/json' \
  -d '{"limit": 1}' \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "    Sales Channel ID: ${SALES_CHANNEL_ID}"

# ── Helper to create a product ────────────────────────────────────────────
create_product() {
  local product_number="$1" name="$2" price="$3" stock="$4" desc="$5"

  echo "==> Creating product: ${name} (${product_number})..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${SHOPWARE_URL}/api/product" \
    -H "${AUTH}" \
    -H 'Content-Type: application/json' \
    -d "{
      \"name\": \"${name}\",
      \"productNumber\": \"${product_number}\",
      \"stock\": ${stock},
      \"taxId\": \"${TAX_ID}\",
      \"price\": [
        {
          \"currencyId\": \"${CURRENCY_ID}\",
          \"gross\": ${price},
          \"net\": $(echo "$price / 1.19" | bc -l | xargs printf '%.2f'),
          \"linked\": true
        }
      ],
      \"description\": \"${desc}\",
      \"active\": true,
      \"visibilities\": [
        {
          \"salesChannelId\": \"${SALES_CHANNEL_ID}\",
          \"visibility\": 30
        }
      ]
    }")

  if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "    Created successfully."
  elif [ "$HTTP_CODE" = "400" ]; then
    echo "    Already exists (skipped)."
  else
    echo "    HTTP ${HTTP_CODE} — check Shopware logs."
  fi
}

# ── Create 5 sample products ──────────────────────────────────────────────

create_product \
  "UCP-SHOES-001" \
  "Running Shoes Pro" \
  129.99 \
  50 \
  "High-performance running shoes with advanced cushioning technology."

create_product \
  "UCP-SNEAKERS-002" \
  "Casual Sneakers" \
  79.99 \
  120 \
  "Comfortable everyday sneakers with breathable mesh upper."

create_product \
  "UCP-BOOTS-003" \
  "Hiking Boots" \
  189.99 \
  30 \
  "Waterproof hiking boots with ankle support and Vibram sole."

create_product \
  "UCP-LOAFERS-004" \
  "Leather Loafers" \
  249.99 \
  15 \
  "Classic Italian leather loafers for formal occasions."

create_product \
  "UCP-SANDALS-005" \
  "Sport Sandals" \
  49.99 \
  200 \
  "Lightweight sport sandals with adjustable straps."

echo ""
echo "==> Done! Verify at: ${SHOPWARE_URL}/api/product"
echo "    Admin panel: ${SHOPWARE_URL}/admin (${ADMIN_USER} / ${ADMIN_PASS})"
echo "    Store API:   ${SHOPWARE_URL}/store-api/"
