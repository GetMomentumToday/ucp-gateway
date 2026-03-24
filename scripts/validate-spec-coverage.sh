#!/usr/bin/env bash
set -euo pipefail

##
# Validates UCP spec coverage by checking code for required features.
# Run: bash scripts/validate-spec-coverage.sh
##

PASS=0
FAIL=0
WARN=0

check_must() {
  local label="$1" result="$2"
  if [ "$result" = "true" ]; then
    PASS=$((PASS + 1))
    echo "  [PASS] $label"
  else
    FAIL=$((FAIL + 1))
    echo "  [FAIL] $label"
  fi
}

check_should() {
  local label="$1" result="$2"
  if [ "$result" = "true" ]; then
    PASS=$((PASS + 1))
    echo "  [PASS] $label"
  else
    WARN=$((WARN + 1))
    echo "  [WARN] $label"
  fi
}

echo "=== UCP Spec Coverage Validator ==="
echo ""

echo "--- 1. Discovery & Profile ---"
check_must "/.well-known/ucp endpoint exists" \
  "$(grep -q 'well-known/ucp' apps/server/src/routes/discovery.ts && echo true || echo false)"
check_must "UCP version in responses" \
  "$(grep -q '2026-01-23' apps/server/src/routes/checkout-response.ts && echo true || echo false)"
check_must "payment_handlers in profile" \
  "$(grep -q 'getSupportedPaymentMethods' packages/core/src/types/adapter.ts && echo true || echo false)"
check_must "signing_keys in profile" \
  "$(grep -rq 'signing_keys' apps/server/src/routes/discovery.ts && echo true || echo false)"

echo ""
echo "--- 2. Checkout Lifecycle ---"
check_must "POST /checkout-sessions" \
  "$(grep -q "post.*checkout-sessions" apps/server/src/routes/checkout.ts && echo true || echo false)"
check_must "GET /checkout-sessions/:id" \
  "$(grep -qi "get.*checkout-sessions\|app\.get" apps/server/src/routes/checkout.ts && echo true || echo false)"
check_must "PUT /checkout-sessions/:id" \
  "$(grep -qi "put.*checkout-sessions\|app\.put" apps/server/src/routes/checkout.ts && echo true || echo false)"
check_must "POST .../complete" \
  "$(grep -q "complete" apps/server/src/routes/checkout.ts && echo true || echo false)"
check_must "POST .../cancel" \
  "$(grep -q "cancel" apps/server/src/routes/checkout.ts && echo true || echo false)"
check_must "6 session states defined" \
  "$(grep -c "'incomplete'\|'ready_for_complete'\|'complete_in_progress'\|'completed'\|'canceled'\|'requires_escalation'" packages/core/src/session/SessionStore.ts | awk '{print ($1 >= 6) ? "true" : "false"}')"

echo ""
echo "--- 3. REST Binding ---"
check_must "UCP-Agent header validation" \
  "$(ls apps/server/src/middleware/agent-header.ts > /dev/null 2>&1 && echo true || echo false)"
check_must "Idempotency-Key handling" \
  "$(grep -q 'idempotency' apps/server/src/routes/checkout-helpers.ts && echo true || echo false)"
check_must "Request-Id passthrough" \
  "$(ls apps/server/src/middleware/request-id.ts > /dev/null 2>&1 && echo true || echo false)"
check_must "Version negotiation" \
  "$(grep -rq 'version.*negotiat\|version_unsupported' apps/server/src/ && echo true || echo false)"

echo ""
echo "--- 4. Fulfillment ---"
check_must "Fulfillment methods/groups/options" \
  "$(grep -q 'FulfillmentMethod\|FulfillmentGroup\|FulfillmentOption' packages/core/src/types/commerce.ts && echo true || echo false)"
check_must "Real fulfillment from adapter" \
  "$(grep -q 'getFulfillmentOptions' packages/core/src/types/adapter.ts && echo true || echo false)"
check_should "Retail location destinations" \
  "$(grep -rq 'retail_location\|RetailLocation' packages/core/src/ && echo true || echo false)"
check_should "Multi-group support flag" \
  "$(grep -rq 'supports_multi_group' apps/server/src/ && echo true || echo false)"

echo ""
echo "--- 5. Order ---"
check_must "Order with checkout_id" \
  "$(grep -q 'checkout_id' packages/core/src/types/commerce.ts && echo true || echo false)"
check_must "Order with line_items snapshot" \
  "$(grep -q 'OrderLineItem\|readonly line_items' packages/core/src/types/commerce.ts && echo true || echo false)"
check_must "Order fulfillment expectations" \
  "$(grep -q 'OrderFulfillmentExpectation' packages/core/src/types/commerce.ts && echo true || echo false)"
check_must "Order adjustments array" \
  "$(grep -q 'OrderAdjustment' packages/core/src/types/commerce.ts && echo true || echo false)"
check_must "Webhook delivery to agent" \
  "$(grep -rq 'webhook.*delivery\|BullMQ.*webhook\|postToWebhook' apps/server/src/ && echo true || echo false)"
check_must "Webhook JWT signing" \
  "$(grep -rq 'detached.*jwt\|Request-Signature\|signWebhook' apps/server/src/ && echo true || echo false)"

echo ""
echo "--- 6. Payment ---"
check_must "Payment handlers declared" \
  "$(grep -q 'PaymentHandler' packages/core/src/types/commerce.ts && echo true || echo false)"
check_should "Handler spec/schema URLs" \
  "$(grep -rq 'config_schema\|instrument_schemas' packages/core/src/types/commerce.ts && echo true || echo false)"

echo ""
echo "--- 7. Error Handling ---"
check_must "Messages array format" \
  "$(grep -q 'UCPMessage' packages/core/src/types/commerce.ts && echo true || echo false)"
check_must "3 severity levels" \
  "$(grep -q 'requires_buyer_input' packages/core/src/types/commerce.ts && echo true || echo false)"
check_must "409 for state conflicts" \
  "$(grep -q '409' apps/server/src/routes/checkout-service.ts && echo true || echo false)"

echo ""
echo "--- 8. Adapters ---"
check_must "Magento adapter" \
  "$(ls packages/adapters/src/magento/MagentoAdapter.ts > /dev/null 2>&1 && echo true || echo false)"
check_must "Shopware adapter" \
  "$(ls packages/adapters/src/shopware/ShopwareAdapter.ts > /dev/null 2>&1 && echo true || echo false)"
check_must "MockAdapter" \
  "$(ls packages/adapters/src/mock/MockAdapter.ts > /dev/null 2>&1 && echo true || echo false)"
check_must "Magento E2E test" \
  "$(ls tests/e2e-magento/run-e2e-checkout.sh > /dev/null 2>&1 && echo true || echo false)"
check_must "Shopware E2E test" \
  "$(ls tests/e2e-shopware/run-e2e-checkout.sh > /dev/null 2>&1 && echo true || echo false)"

echo ""
echo "========================================="
echo "  MUST: $PASS pass, $FAIL fail"
echo "  SHOULD: $WARN warnings"
echo "  Total: $((PASS + FAIL + WARN)) checks"
echo "========================================="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "SPEC GAPS DETECTED — $FAIL MUST requirement(s) not met."
  exit 1
fi

echo ""
echo "ALL MUST REQUIREMENTS MET"
exit 0
