#!/usr/bin/env bash
set -euo pipefail

##
# Create sample products in Magento 2 via REST API.
#
# Prerequisites:
#   docker compose -f platforms/docker-compose.platforms.yml up -d
#   Wait until Magento is healthy (~5 min first boot)
#
# Usage:
#   bash platforms/magento/setup-products.sh
##

MAGENTO_URL="${MAGENTO_URL:-http://localhost:8080}"
ADMIN_USER="${MAGENTO_ADMIN_USER:-admin}"
ADMIN_PASS="${MAGENTO_ADMIN_PASSWORD:-magentorocks1}"

echo "==> Authenticating with Magento at ${MAGENTO_URL}..."
TOKEN=$(curl -s -X POST "${MAGENTO_URL}/rest/V1/integration/admin/token" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}" | tr -d '"')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "ERROR: Failed to get admin token. Is Magento running?"
  exit 1
fi
echo "    Token acquired."

AUTH="Authorization: Bearer ${TOKEN}"

# ── Helper to create a simple product ─────────────────────────────────────
create_product() {
  local sku="$1" name="$2" price="$3" qty="$4" desc="$5"

  echo "==> Creating product: ${name} (SKU: ${sku})..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${MAGENTO_URL}/rest/V1/products" \
    -H "${AUTH}" \
    -H 'Content-Type: application/json' \
    -d "{
      \"product\": {
        \"sku\": \"${sku}\",
        \"name\": \"${name}\",
        \"price\": ${price},
        \"status\": 1,
        \"visibility\": 4,
        \"type_id\": \"simple\",
        \"attribute_set_id\": 4,
        \"weight\": 1.0,
        \"extension_attributes\": {
          \"stock_item\": {
            \"qty\": ${qty},
            \"is_in_stock\": true
          }
        },
        \"custom_attributes\": [
          { \"attribute_code\": \"description\", \"value\": \"${desc}\" },
          { \"attribute_code\": \"short_description\", \"value\": \"${desc}\" },
          { \"attribute_code\": \"url_key\", \"value\": \"${sku}\" },
          { \"attribute_code\": \"tax_class_id\", \"value\": \"2\" }
        ]
      }
    }")

  if [ "$HTTP_CODE" = "200" ]; then
    echo "    Created successfully."
  elif [ "$HTTP_CODE" = "400" ]; then
    echo "    Already exists (skipped)."
  else
    echo "    HTTP ${HTTP_CODE} — check Magento logs."
  fi
}

# ── Create 5 sample products ──────────────────────────────────────────────

create_product \
  "ucp-shoes-001" \
  "Running Shoes Pro" \
  129.99 \
  50 \
  "High-performance running shoes with advanced cushioning technology."

create_product \
  "ucp-sneakers-002" \
  "Casual Sneakers" \
  79.99 \
  120 \
  "Comfortable everyday sneakers with breathable mesh upper."

create_product \
  "ucp-boots-003" \
  "Hiking Boots" \
  189.99 \
  30 \
  "Waterproof hiking boots with ankle support and Vibram sole."

create_product \
  "ucp-loafers-004" \
  "Leather Loafers" \
  249.99 \
  15 \
  "Classic Italian leather loafers for formal occasions."

create_product \
  "ucp-sandals-005" \
  "Sport Sandals" \
  49.99 \
  200 \
  "Lightweight sport sandals with adjustable straps."

echo ""
echo "==> Done! Verify at: ${MAGENTO_URL}/rest/V1/products?searchCriteria[pageSize]=10"
echo "    Admin panel: ${MAGENTO_URL}/admin  (${ADMIN_USER} / ${ADMIN_PASS})"
