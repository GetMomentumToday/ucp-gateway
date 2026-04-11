# UCP Order Specification (v2026-04-08)

Source: https://ucp.dev/2026-04-08/schemas/shopping/order.json

## Order Object (top-level)

**Required**: `ucp`, `id`, `checkout_id`, `permalink_url`, `line_items`, `fulfillment`, `currency`, `totals`
**Optional**: `adjustments`

| Field                      | Type                 | Required | Description                                      |
| -------------------------- | -------------------- | -------- | ------------------------------------------------ |
| `ucp`                      | `UcpOrderResponse`   | YES      | UCP metadata envelope                            |
| `id`                       | `string`             | YES      | Unique order identifier                          |
| `checkout_id`              | `string`             | YES      | Associated checkout ID                           |
| `permalink_url`            | `string` (URI)       | YES      | Permalink to order on merchant site              |
| `line_items`               | `OrderLineItem[]`    | YES      | Immutable — source of truth for what was ordered |
| `fulfillment`              | `object`             | YES      | Fulfillment data                                 |
| `fulfillment.expectations` | `Expectation[]`      | optional | Buyer-facing groups for when/how items arrive    |
| `fulfillment.events`       | `FulfillmentEvent[]` | optional | Append-only event log of actual shipments        |
| `adjustments`              | `Adjustment[]`       | optional | Append-only event log of money movements         |
| `totals`                   | `Total[]`            | YES      | Order totals breakdown                           |

## UCP Metadata Envelope

Required fields: `version`, `capabilities`

```json
{
  "version": "2026-04-08",
  "capabilities": [
    {
      "name": "dev.ucp.shopping.order",
      "version": "2026-04-08"
    }
  ]
}
```

Order responses do NOT include `payment_handlers` (payment is concluded).

## Order Line Items

**Required**: `id`, `item`, `quantity`, `totals`, `status`
**Optional**: `parent_id`

```json
{
  "id": "li-0",
  "item": {
    "id": "product-123",
    "title": "Running Shoes",
    "price": 12999,
    "image_url": "https://..."
  },
  "quantity": {
    "total": 2,
    "fulfilled": 0
  },
  "totals": [
    { "type": "subtotal", "amount": 25998 },
    { "type": "total", "amount": 25998 }
  ],
  "status": "processing"
}
```

### Status derivation rules

- `"fulfilled"` — `quantity.fulfilled == quantity.total`
- `"partial"` — `quantity.fulfilled > 0 && quantity.fulfilled < quantity.total`
- `"processing"` — `quantity.fulfilled == 0`

## Fulfillment Expectations

**Required**: `id`, `line_items`, `method_type`, `destination`
**Optional**: `description`, `fulfillable_on`

```json
{
  "id": "exp-1",
  "line_items": [{ "id": "li-0", "quantity": 2 }],
  "method_type": "shipping",
  "destination": {
    "street_address": "123 Main St",
    "address_locality": "New York",
    "address_region": "NY",
    "postal_code": "10001",
    "address_country": "US"
  },
  "description": "Arrives in 5-8 business days"
}
```

## Fulfillment Events

**Required**: `id`, `occurred_at`, `type`, `line_items`
**Optional**: `tracking_number`, `tracking_url`, `carrier`, `description`

```json
{
  "id": "evt-1",
  "occurred_at": "2026-03-25T12:00:00Z",
  "type": "shipped",
  "line_items": [{ "id": "li-0", "quantity": 2 }],
  "tracking_number": "1Z999AA10123456784",
  "tracking_url": "https://tracking.example.com/1Z999AA10123456784",
  "carrier": "UPS"
}
```

Common event types: `processing`, `shipped`, `in_transit`, `delivered`,
`failed_attempt`, `canceled`, `undeliverable`, `returned_to_sender`

Events are **append-only** — never modified or deleted.

## Adjustments

**Required**: `id`, `type`, `occurred_at`, `status`
**Optional**: `line_items`, `amount`, `description`

```json
{
  "id": "adj-1",
  "type": "refund",
  "occurred_at": "2026-03-26T10:00:00Z",
  "status": "completed",
  "line_items": [{ "id": "li-0", "quantity": 1 }],
  "amount": 12999,
  "description": "Defective item"
}
```

Typical types: `refund`, `return`, `credit`, `price_adjustment`, `dispute`, `cancellation`

Adjustments are **append-only** and independent of fulfillment.

## Totals

**Required**: `type`, `amount`
**Optional**: `display_text`

```json
{ "type": "subtotal", "amount": 25998 }
{ "type": "discount", "amount": -500, "display_text": "SAVE5" }
{ "type": "fulfillment", "amount": 999, "display_text": "Standard Shipping" }
{ "type": "tax", "amount": 2340 }
{ "type": "total", "amount": 28837 }
```

Formula: `total = subtotal - discount + fulfillment + tax + fee` (must be >= 0)

Used in both `order.totals` and `line_item.totals`.

## Checkout Complete Response

The `order` field in the checkout complete response is **MINIMAL**:

```json
{
  "status": "completed",
  "order": {
    "id": "order-abc-123",
    "permalink_url": "https://store.example.com/orders/abc-123"
  }
}
```

The full Order entity is returned by `GET /orders/:id`, NOT embedded in checkout.

## GET /orders/:id Behavior

- Returns the **full Order entity** as defined above
- Line items are immutable
- Fulfillment events are append-only
- Adjustments are append-only
- Line item status is derived from quantity.fulfilled vs quantity.total
