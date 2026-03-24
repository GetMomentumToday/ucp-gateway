# UCP Specification — Exhaustive Requirements Reference

> Extracted from https://ucp.dev/latest/specification/ (version 2026-01-23)
> RFC 2119/8174 keyword interpretation applies throughout.

---

## Table of Contents

1. [Overview (Discovery, Governance, Negotiation)](#1-overview)
2. [Checkout Capability](#2-checkout-capability)
3. [Fulfillment Extension](#3-fulfillment-extension)
4. [Discounts Extension](#4-discounts-extension)
5. [Buyer Consent Extension](#5-buyer-consent-extension)
6. [AP2 Mandates Extension](#6-ap2-mandates-extension)
7. [Order Capability](#7-order-capability)
8. [Identity Linking Capability](#8-identity-linking-capability)
9. [REST Binding (checkout-rest)](#9-rest-binding)
10. [MCP Binding (checkout-mcp)](#10-mcp-binding)
11. [A2A Binding (checkout-a2a)](#11-a2a-binding)
12. [Embedded Checkout Binding (EP)](#12-embedded-checkout-binding)
13. [Payment Handler Guide](#13-payment-handler-guide)
14. [Tokenization Guide](#14-tokenization-guide)
15. [Reference (Schemas)](#15-reference)

---

## 1. Overview

**URL:** https://ucp.dev/latest/specification/overview/

### 1.1 MUST Requirements

1. "Platform **MUST** validate this binding and **SHOULD** reject capabilities where the spec origin does not match the namespace authority." (Spec URL Binding)
2. "Vendors **MUST** use their own reverse-domain namespace for custom capabilities."
3. `endpoint` **MUST** be a valid URL with scheme (https).
4. Transport definitions (OpenAPI/OpenRPC) **MUST** reference base schemas only.
5. Transport definitions **MUST NOT** enumerate fields or define payload shapes inline.
6. Extensions **MUST** be self-describing.
7. Platforms **MUST** resolve schemas client-side by fetching and composing.
8. Composed type names **MUST** follow: `{capability-name}.{TypeName}`.
9. Platforms **MUST** include profile URI in every request (Profile Advertisement).
10. Platforms **MUST** validate spec URI origins match authorities (Namespace Validation).
11. Platforms **MUST** fetch and compose schemas before requests (Schema Resolution).
12. Businesses **MUST** fetch and validate platform profile unless cached (Profile Resolution).
13. Businesses **MUST** compute intersection of platform/business capabilities (Capability Intersection).
14. Extensions without parent in intersection **MUST** be excluded.
15. Businesses **MUST** include `ucp` field in every response with `version` and `capabilities`.
16. All UCP communication **MUST** occur over **HTTPS** (Transport Security).
17. Webhooks **MUST** be signed using shared secret or asymmetric key.
18. Sensitive data (Payment Credentials, PII) **MUST** be handled per PCI-DSS and GDPR.
19. Businesses **MUST NOT** echo credentials back in responses.
20. Businesses **MUST** filter `handlers` list based on cart context (Dynamic Filtering).
21. If platform version <= business version: Business **MUST** process request.
22. If platform version > business version: Business **MUST** return `version_unsupported` error.
23. Businesses **MUST** include version used for processing in every response.
24. Breaking changes **MUST NOT** be introduced without a new version.
25. Capabilities **MUST** follow same backwards compatibility rules.
26. Businesses **MUST** validate capability version compatibility.
27. MCP Transport: Platforms **MUST** include `meta` object containing `ucp-agent` with `profile`.

### 1.2 SHOULD Requirements

1. Platform **SHOULD** reject capabilities where the spec origin does not match the namespace authority.
2. `endpoint` **SHOULD NOT** have trailing slash.
3. Requests **SHOULD** be authenticated using standard headers (Authorization: Bearer).
4. Businesses implementing version **SHOULD** handle requests from platforms using that version or older.

### 1.3 MAY Requirements

1. Platforms **MAY** fetch business profile from `/.well-known/ucp` (Discovery).
2. Platforms **MAY** include risk signals in `complete` call.
3. Future extensions **MAY** standardize fraud signal schemas.
4. Transports **MAY** define own version handling.
5. Individual UCP capabilities **MAY** version independently when breaking changes required.
6. Businesses **MAY** expose MCP server wrapping UCP implementation.
7. Businesses **MAY** expose A2A agent supporting UCP as extension.
8. Businesses **MAY** embed interface onto eligible host via Embedded Protocol.

### 1.4 Key Data Structures

#### Business Profile (at `/.well-known/ucp`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ucp.version` | string | Yes | YYYY-MM-DD format |
| `ucp.services` | object | Yes | Service definitions indexed by reverse-domain name |
| `ucp.capabilities` | object | No | Capability definitions indexed by reverse-domain name |
| `ucp.payment_handlers` | object | Yes | Payment handler definitions |
| `signing_keys` | array | No | JWK format public keys for webhook verification |

#### Service Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | YYYY-MM-DD format |
| `spec` | string | Yes | Service documentation URL |
| `rest.schema` | string | Yes (if REST) | OpenAPI spec URL (JSON) |
| `rest.endpoint` | string | Yes (if REST) | Business's REST endpoint |
| `mcp.schema` | string | Yes (if MCP) | OpenRPC spec URL (JSON) |
| `mcp.endpoint` | string | Yes (if MCP) | Business's MCP endpoint |
| `a2a.endpoint` | string | Yes (if A2A) | Business's Agent Card URL |
| `embedded.schema` | string | Yes (if embedded) | OpenRPC spec URL (JSON) |

#### Capability Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | No | YYYY-MM-DD format |
| `spec` | string | Yes | Human-readable spec document URL |
| `schema` | string | Yes | JSON Schema URL defining structure |
| `id` | string | No | Unique identifier for instance |
| `config` | object | No | Entity-specific configuration |
| `extends` | string | No | Parent capability identifier |

#### Signing Key (JWK)

| Field | Type | Description |
|-------|------|-------------|
| `kid` | string | Key ID |
| `kty` | string | Key type (EC) |
| `crv` | string | Curve (P-256) |
| `x`, `y` | string | Coordinates |
| `use` | string | Usage (sig) |
| `alg` | string | Algorithm (ES256) |

### 1.5 Namespace Governance

| Namespace Pattern | Authority | Governance |
|---|---|---|
| `dev.ucp.*` | ucp.dev | UCP governing body |
| `com.{vendor}.*` | {vendor}.com | Vendor organization |
| `org.{org}.*` | {org}.org | Organization |

### 1.6 Naming Convention

All capability and service names follow: `[reverse-domain].{service}.{capability}`

Examples:
- `dev.ucp.shopping.checkout`
- `dev.ucp.shopping.fulfillment`
- `dev.ucp.common.identity_linking`
- `com.example.payments.installments`

### 1.7 Version Error Response

```json
{
  "status": "requires_escalation",
  "messages": [{
    "type": "error",
    "code": "version_unsupported",
    "message": "Version 2026-01-24 not supported. Business implements 2026-01-23.",
    "severity": "requires_buyer_input"
  }]
}
```

### 1.8 Backwards Compatibility Rules

**Backwards-Compatible (allowed without version bump):**
- Adding new non-required fields to responses
- Adding new non-required parameters to requests
- Adding new endpoints, methods, operations
- Adding new error codes with existing structures
- Adding new enum values (unless explicitly exhaustive)
- Changing field order in responses
- Changing opaque string length/format (IDs, tokens)

**Breaking (MUST NOT without new version):**
- Removing/renaming existing fields
- Changing field types/semantics
- Making non-required fields required
- Removing operations, methods, endpoints
- Changing authentication/authorization requirements
- Modifying protocol flow or state machine
- Changing meaning of existing error codes

### 1.9 Negotiation Algorithm

1. Compute intersection: Include business capability if platform has matching name
2. Prune orphaned extensions: Remove capabilities where `extends` parent not in intersection
3. Repeat pruning: Continue until no more removals (transitive chains)

### 1.10 UCP-Agent Header

**HTTP (RFC 8941):**
```
UCP-Agent: profile="https://agent.example/profiles/shopping-agent.json"
```

**MCP meta object:**
```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/profiles/shopping-agent.json"
    },
    "idempotency-key": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 1.11 Glossary

| Term | Acronym | Definition |
|------|---------|-----------|
| Agent Payments Protocol | AP2 | Open protocol enabling AI agents to securely interoperate and complete payments autonomously |
| Agent2Agent Protocol | A2A | Open standard for secure, collaborative communication between diverse AI agents |
| Capability | -- | Standalone core feature a business supports |
| Credential Provider | CP | Trusted entity managing user's payment/identity credentials |
| Extension | -- | Optional capability augmenting another via `extends` field |
| Profile | -- | JSON document at well-known URI declaring identity, capabilities, endpoints |
| Business | -- | Entity selling goods/services; Merchant of Record (MoR) |
| Model Context Protocol | MCP | Protocol standardizing AI model connection to external data and tools |
| Universal Commerce Protocol | UCP | Standard enabling interoperability via standardized capabilities and discovery |
| Payment Service Provider | PSP | Financial infrastructure provider processing payments |
| Platform | -- | Consumer-facing surface acting on user's behalf |
| Verifiable Digital Credential | VDC | Issuer-signed credential verifiable cryptographically |
| Verifiable Presentation | VP | Presentation of one or more VDCs with cryptographic proof |

---

## 2. Checkout Capability

**URL:** https://ucp.dev/latest/specification/checkout/
**Capability Name:** `dev.ucp.shopping.checkout`

### 2.1 MUST Requirements

1. "Businesses **MUST** provide `continue_url` when returning `status` = `requires_escalation`."
2. "The `continue_url` **MUST** be an absolute HTTPS URL."
3. "Businesses **MUST** send a confirmation email after the checkout has been completed."
4. "Logic handling the checkout sessions **MUST** be deterministic."
5. "**MUST** include at least one message with `severity: escalation` when returning `status` = `requires_escalation`."
6. "Platforms **MUST** use `continue_url` when checkout status is `requires_escalation`."
7. "The platform is **REQUIRED** to send the entire checkout resource containing any data updates to write-only data fields." (Update Checkout)
8. "After a checkout session reaches the state 'completed', it is considered immutable."

### 2.2 SHOULD Requirements

1. "Product data (price/title etc.) provided by the business through the feeds **SHOULD** match the actual attributes returned in the response."
2. "For all other non-terminal statuses (`incomplete`, `ready_for_complete`, `complete_in_progress`), businesses **SHOULD** provide `continue_url`."
3. "For terminal states (`completed`, `canceled`), `continue_url` **SHOULD** be omitted."
4. "Businesses **SHOULD** implement support for this format to facilitate checkout handoff and accelerated entry." (Server-Side State)
5. "When performing handoff, **SHOULD** prefer business-provided `continue_url` over platform-constructed checkout permalinks."
6. "Businesses **SHOULD** provide all relevant links for the transaction."
7. "Businesses **SHOULD** surface such messages as early as possible, and platforms **SHOULD** prioritize resolving recoverable errors before initiating handoff."
8. "Businesses SHOULD use these values when authoritative data (e.g., address) is absent." (Context)
9. "Platforms **SHOULD** progressively enhance context throughout the buyer journey."
10. "Consumers **SHOULD** handle unknown values gracefully by displaying them using the `title` field or omitting the link."
11. "Any checkout session with a status that is not equal to `completed` or `canceled` **SHOULD** be cancelable."
12. "`continue_url` **SHOULD** preserve checkout state for seamless handoff."

### 2.3 MAY Requirements

1. "Platforms **MAY** engage an agent to facilitate the checkout session."
2. "Platforms **MAY** provide agent context when the platform indicates that the request was done by an agent."
3. "Platforms **MAY** use `continue_url` to hand off to business UI in other situations."
4. "Businesses **MAY** implement state preservation using either approach."
5. "Businesses **MAY** define custom types for domain-specific needs." (Link types)
6. "At the time of order persistence, fields from `Checkout` **MAY** be used to construct the order representation."
7. "Businesses MAY ignore unsupported values without returning errors." (Context)

### 2.4 Checkout Status Lifecycle

**Non-Terminal States:**
- `incomplete` -- Session missing required info; inspect `messages` array
- `requires_escalation` -- Cannot be resolved via API; buyer input needed
- `ready_for_complete` -- All info present; platform can call Complete
- `complete_in_progress` -- Business is processing Complete request

**Terminal States:**
- `completed` -- Order placed successfully
- `canceled` -- Session invalid/expired

### 2.5 Error Severity Types

| Severity | Meaning | Platform Action |
|----------|---------|-----------------|
| `recoverable` | Platform can fix via API | Resolve using Update Checkout |
| `requires_buyer_input` | Business requires input not available via API | Hand off via `continue_url` |
| `requires_buyer_review` | Buyer review and authorization required | Hand off via `continue_url` |

### 2.6 Error Codes (Checkout)

- `invalid_phone`
- `schedule_delivery`
- `high_value_order`
- `missing`
- `invalid`
- `out_of_stock`
- `payment_declined`
- `requires_sign_in`
- `requires_3ds`
- `requires_identity_linking`
- Freeform codes also allowed

### 2.7 Core Operations

| Operation | Purpose |
|-----------|---------|
| Create Checkout | Initiate checkout session with item details |
| Get Checkout | Retrieve latest state of checkout resource |
| Update Checkout | Full replacement of checkout resource |
| Complete Checkout | Final order placement call |
| Cancel Checkout | Cancel a checkout session |

### 2.8 Data Schemas

#### Buyer

| Field | Type | Required |
|-------|------|----------|
| `first_name` | string | No |
| `last_name` | string | No |
| `email` | string | No |
| `phone_number` | string (E.164) | No |

#### Context (Provisional Signals)

| Field | Type | Required |
|-------|------|----------|
| `address_country` | string (ISO 3166-1 alpha-2) | No |
| `address_region` | string | No |
| `postal_code` | string | No |

#### Item

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | Yes | Must match platform and business recognition |
| `title` | string | Yes | Response only |
| `price` | integer | Yes | Minor currency units, response only |
| `image_url` | string | No | Response only |

#### Line Item

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | Yes | Response only |
| `item` | Item | Yes | |
| `quantity` | integer | Yes | |
| `totals` | Array[Total] | Yes | Response only |
| `parent_id` | string | No | For nested structures |

#### Postal Address

| Field | Type | Required |
|-------|------|----------|
| `extended_address` | string | No |
| `street_address` | string | No |
| `address_locality` | string | No |
| `address_region` | string | No (required for applicable countries) |
| `address_country` | string (ISO 3166-1 alpha-2 recommended) | No |
| `postal_code` | string | No |
| `first_name` | string | No |
| `last_name` | string | No |
| `phone_number` | string | No |

#### Total

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Enum: `items_discount`, `subtotal`, `discount`, `fulfillment`, `tax`, `fee`, `total` |
| `display_text` | string | No | Text to display |
| `amount` | integer | Yes | Minor currency units; if type=="total", >= 0 |

#### Payment Instrument

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `handler_id` | string | Yes |
| `type` | string | Yes |
| `billing_address` | Postal Address | No |
| `credential` | Payment Credential | No |
| `display` | object | No |

#### Selected Payment Instrument

Extends Payment Instrument with:
| Field | Type | Required |
|-------|------|----------|
| `selected` | boolean | No |

#### Payment Credential

| Field | Type | Required |
|-------|------|----------|
| `type` | string | Yes (discriminator) |

#### Message Error

| Field | Type | Required |
|-------|------|----------|
| `type` | string | Yes (constant: "error") |
| `code` | string | Yes |
| `path` | string (RFC 9535 JSONPath) | No |
| `content_type` | string ("plain"/"markdown") | No (default: "plain") |
| `content` | string | Yes |
| `severity` | string | Yes (enum: "recoverable", "requires_buyer_input", "requires_buyer_review") |

#### Message Warning

| Field | Type | Required |
|-------|------|----------|
| `type` | string | Yes (constant: "warning") |
| `path` | string | No |
| `code` | string | Yes |
| `content` | string | Yes (MUST be displayed) |
| `content_type` | string | No |

#### Message Info

| Field | Type | Required |
|-------|------|----------|
| `type` | string | Yes (constant: "info") |
| `path` | string | No |
| `code` | string | No |
| `content_type` | string | No |
| `content` | string | Yes |

#### Link

| Field | Type | Required |
|-------|------|----------|
| `type` | string | Yes |
| `url` | string | Yes |
| `title` | string | No |

**Well-Known Link Types:** `privacy_policy`, `terms_of_service`, `refund_policy`, `shipping_policy`, `faq`

#### Order Confirmation

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `permalink_url` | string | Yes |

#### Root Checkout Response

| Field | Type | Required |
|-------|------|----------|
| `ucp` | UCP Response Checkout | Yes |
| `id` | string | Yes |
| `line_items` | Array[Line Item] | Yes |
| `buyer` | Buyer | No |
| `status` | string (enum) | Yes |
| `currency` | string (ISO 4217) | Yes |
| `totals` | Array[Total] | Yes |
| `messages` | Array[Message] | No |
| `links` | Array[Link] | Yes |
| `expires_at` | string (RFC 3339) | No (default: 6 hours) |
| `continue_url` | string | No (MUST for requires_escalation) |
| `payment` | Payment | No |
| `order` | Order Confirmation | No |

---

## 3. Fulfillment Extension

**URL:** https://ucp.dev/latest/specification/fulfillment/
**Capability Name:** `dev.ucp.shopping.fulfillment`
**Extends:** `dev.ucp.shopping.checkout`

### 3.1 MUST Requirements

1. Option `title` "**MUST** distinguish this option from its siblings."
2. Option `title` "**MUST** be sufficient for buyer decision if description is absent."
3. Available methods `description` "**MUST** be a standalone sentence explaining what, when, and where."
4. When `supports_multi_group: false` (default), businesses "**MUST** consolidate all items into a single group per method."
5. Extensions "**MUST** add the method to the type enum in fulfillment_method."
6. Option `description` "**MUST NOT** repeat title or total -- provides supplementary context only."

### 3.2 SHOULD Requirements

1. "Businesses **SHOULD** return options[] in a meaningful order."
2. "Platforms **SHOULD** render options in the provided order."
3. Option title "**SHOULD** include method and speed (e.g., 'Express Shipping', 'Curbside Pickup')."
4. Description "**SHOULD** include timing, carrier, or other decision-relevant details."
5. Description "**SHOULD** be a complete phrase (e.g., 'Arrives Dec 12-15 via FedEx')."
6. "Platforms **SHOULD** treat fulfillment as a generic, renderable structure."
7. "Platforms **SHOULD** use available_methods[].description to surface alternatives."
8. Platform "**SHOULD** use continue_url to hand off to the business's checkout" when unable to process.

### 3.3 MAY Requirements

1. Business "**MAY** still return multiple methods (e.g., shipping + pickup)."
2. When `supports_multi_group: true`, business "**MAY** return multiple groups per method based on inventory."
3. "Platforms **MAY** provide enhanced UX for recognized method types."
4. Description "**MAY** be omitted if title is self-explanatory."
5. Available methods description "**MAY** be omitted if title is self-explanatory."

### 3.4 Data Schemas

#### FulfillmentMethod

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `type` | string (enum: `shipping`, `pickup`) | Yes |
| `line_item_ids` | array[string] | Yes |
| `destinations` | array[FulfillmentDestination] | No |
| `selected_destination_id` | string/null | No |
| `groups` | array[FulfillmentGroup] | No |

#### FulfillmentGroup

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `line_item_ids` | array[string] | Yes |
| `options` | array[FulfillmentOption] | No |
| `selected_option_id` | string/null | No |

#### FulfillmentOption

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `title` | string | Yes |
| `description` | string | No |
| `carrier` | string | No |
| `earliest_fulfillment_time` | string (ISO 8601) | No |
| `latest_fulfillment_time` | string (ISO 8601) | No |
| `totals` | array[Total] | Yes |

#### FulfillmentDestination (union type)

Either `ShippingDestination` (extends Postal Address with `id`) or `RetailLocation`.

#### RetailLocation

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `name` | string | Yes |
| `address` | PostalAddress | No |

#### FulfillmentAvailableMethod

| Field | Type | Required |
|-------|------|----------|
| `type` | string (enum: `shipping`, `pickup`) | Yes |
| `line_item_ids` | array[string] | Yes |
| `fulfillable_on` | string/null ("now" or ISO 8601) | No |
| `description` | string | No |

### 3.5 Configuration

**Platform Profile (`platform_schema`):**
- `supports_multi_group` (boolean): Enables multiple groups per method. Default: false.

**Business Profile (`merchant_config`):**
- `allows_multi_destination` (object): Per-type multi-destination support
- `allows_method_combinations` (array): Allowed method type combinations

---

## 4. Discounts Extension

**URL:** https://ucp.dev/latest/specification/discount/
**Capability Name:** `dev.ucp.shopping.discount`
**Extends:** `dev.ucp.shopping.checkout`

### 4.1 SHOULD Requirements

1. "Operations that affect order totals, or the user's expectation of the total, **SHOULD** use `type: \"warning\"` to ensure they are surfaced to the user rather than silently handled by platforms."

### 4.2 Data Schemas

#### Discounts Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `codes` | array[string] | No | Case-insensitive. Replaces previously submitted codes. Empty array clears. |
| `applied` | array[AppliedDiscount] | No | Discounts successfully applied (code-based and automatic) |

#### Applied Discount

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | No | Omitted for automatic discounts |
| `title` | string | Yes | Human-readable name |
| `amount` | integer | Yes | Total discount in minor currency units |
| `automatic` | boolean | No | True if applied automatically |
| `method` | string (enum: `each`, `across`) | No | Allocation method |
| `priority` | integer | No | Stacking order (lower = first) |
| `allocations` | array[Allocation] | No | Breakdown of where discount allocated |

#### Allocation

| Field | Type | Required |
|-------|------|----------|
| `path` | string (JSONPath) | Yes |
| `amount` | integer | Yes |

**Invariant:** Sum of `allocations[].amount` equals `applied_discount.amount`.

### 4.3 Error Codes (Discount)

| Code | Description |
|------|-------------|
| `discount_code_expired` | Code has expired |
| `discount_code_invalid` | Code not found or malformed |
| `discount_code_already_applied` | Code is already applied |
| `discount_code_combination_disallowed` | Cannot combine with another active discount |
| `discount_code_user_not_logged_in` | Code requires authenticated user |
| `discount_code_user_ineligible` | User does not meet eligibility criteria |

### 4.4 Allocation Method

| Method | Meaning |
|--------|---------|
| `each` | Applied independently per eligible item |
| `across` | Split proportionally by value |

### 4.5 Stacking Example

```
Cart: $100
Discount A (priority: 1): 20% off -> $100 x 0.8 = $80
Discount B (priority: 2): $10 off -> $80 - $10 = $70
```

### 4.6 Impact on Totals

| Total Type | When to Use |
|------------|------------|
| `items_discount` | Discounts allocated to line items (`$.line_items[*]`) |
| `discount` | Order-level discounts (shipping, fees, flat order amount) |

**Invariant:** `totals[type=items_discount].amount` equals `sum(line_items[].discount)`.

All discount amounts are positive integers in minor currency units. Display as subtractive (e.g., "-$13.99").

### 4.7 Operations

- **Replacement semantics**: Submitting `discounts.codes` replaces previously submitted codes
- **Clear codes**: Send empty array `"codes": []` to remove all codes
- **Case-insensitive**: Codes matched case-insensitively

---

## 5. Buyer Consent Extension

**URL:** https://ucp.dev/latest/specification/buyer-consent/
**Capability Name:** `dev.ucp.shopping.buyer_consent`
**Extends:** `dev.ucp.shopping.checkout`

### 5.1 Data Schema

#### Consent Object (at `checkout.buyer.consent`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `analytics` | boolean | No | Consent for analytics and performance tracking |
| `preferences` | boolean | No | Consent for storing user preferences |
| `marketing` | boolean | No | Consent for marketing communications |
| `sale_of_data` | boolean | No | Consent for selling data to third parties (CCPA) |

### 5.2 Key Principles

- Consent is declarative -- protocol communicates consent but doesn't enforce it
- Legal compliance remains the business's responsibility
- Platforms should not assume consent without explicit user action
- Default behavior when consent is not provided is business-specific
- Consent states should align with actual user choices, not platform defaults

---

## 6. AP2 Mandates Extension

**URL:** https://ucp.dev/latest/specification/ap2-mandates/
**Capability Name:** `dev.ucp.shopping.ap2_mandate`
**Extends:** `dev.ucp.shopping.checkout`

### 6.1 MUST Requirements

1. "Businesses **MUST** embed a cryptographic signature in checkout responses, proving the terms (price, line items) are authentic."
2. "Platforms **MUST** provide cryptographically signed proofs (Mandates) during the `complete` operation."
3. "The business **MUST** include `ap2.merchant_authorization` in all checkout responses" when AP2 is negotiated.
4. "The business **MUST NOT** accept a `complete_checkout` request that lacks `ap2.checkout_mandate`."
5. "The platform **MUST** verify the business's signature before presenting the checkout to the user."
6. "All signatures **MUST** use one of the following algorithms: ES256, ES384, or ES512."
7. "Businesses **MUST** embed their signature in the checkout response body under `ap2.merchant_authorization` using **JWS Detached Content** format."
8. "The signature **MUST** cover both the JWS header and the checkout payload."
9. "Implementations **MUST** use **JSON Canonicalization Scheme (JCS)** as defined in RFC 8785."
10. "When computing the business's signature, exclude the `ap2` field entirely."
11. "The platform **MUST** produce two distinct mandate artifacts: `checkout_mandate` in `ap2.checkout_mandate` and `payment_mandate` in `payment.instruments[*].credential.token`."
12. "The checkout mandate **MUST** contain the full checkout response including the `ap2.merchant_authorization` field."
13. "Both parties **MUST** follow these steps to ensure cryptographic integrity; any attempt to bypass **MUST** result in a session failure."
14. "If AP2 was negotiated, reject the request with `mandate_required` error code if `ap2.checkout_mandate` is missing."
15. "The business **MUST**: Verify Mandate: Decode and verify the SD-JWT signature, key binding, and expiration per the AP2 Protocol Specification."
16. "Confirm the embedded checkout terms match the current session state (id, totals, line items)."
17. "Upon user consent, the platform signs the mandates using their server-side key."
18. "To utilize this extension, a public signing key **MUST** be available for the business to verify the mandate's signature."
19. "If a public key cannot be resolved, or if the signature is invalid, the business **MUST** return an error."

### 6.2 Signature Algorithms

| Algorithm | Description |
|-----------|-------------|
| ES256 | ECDSA using P-256 curve and SHA-256 (**RECOMMENDED**) |
| ES384 | ECDSA using P-384 curve and SHA-384 |
| ES512 | ECDSA using P-521 curve and SHA-512 |

### 6.3 JWS Header Claims

| Claim | Type | Required |
|-------|------|----------|
| `alg` | string | Yes (ES256/ES384/ES512) |
| `kid` | string | Yes (references business's `signing_keys`) |

### 6.4 Data Schemas

#### AP2 Checkout Response

| Field | Type | Required |
|-------|------|----------|
| `merchant_authorization` | string (JWS Detached) | No (MUST when AP2 negotiated) |

Pattern: `^[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+$`

#### AP2 Complete Request

| Field | Type | Required |
|-------|------|----------|
| `checkout_mandate` | string (SD-JWT+kb) | No (MUST when AP2 negotiated) |

Pattern: `^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+(~[A-Za-z0-9_-]+)*$`

### 6.5 Error Codes (AP2)

| Code | Description |
|------|-------------|
| `mandate_required` | AP2 negotiated but request lacks `ap2.checkout_mandate` |
| `agent_missing_key` | Platform profile lacks valid `signing_keys` entry |
| `mandate_invalid_signature` | Mandate signature cannot be verified |
| `mandate_expired` | Mandate `exp` timestamp has passed |
| `mandate_scope_mismatch` | Mandate bound to different checkout |
| `merchant_authorization_invalid` | Business authorization signature verification failed |
| `merchant_authorization_missing` | AP2 negotiated but response lacks `ap2.merchant_authorization` |

---

## 7. Order Capability

**URL:** https://ucp.dev/latest/specification/order/
**Capability Name:** `dev.ucp.shopping.order`

### 7.1 MUST Requirements

1. "Platforms **MUST** respond quickly with a 2xx HTTP status code to acknowledge receipt." (Webhooks)
2. "Businesses **MUST** sign all webhook payloads using a key from their `signing_keys` array (published in `/.well-known/ucp`). The signature **MUST** be included in the `Request-Signature` header as a detached JWT (RFC 7797)."
3. "Businesses **MUST** send 'Order created' event with fully populated order entity."
4. "Businesses **MUST** send full order entity on updates (not incremental deltas)."
5. "Businesses **MUST** retry failed webhook deliveries."
6. "Businesses **MUST** include business identifier in webhook path or headers."

### 7.2 Data Schemas

#### Order

| Field | Type | Required |
|-------|------|----------|
| `ucp` | UCP Response Order Schema | Yes |
| `id` | string | Yes |
| `checkout_id` | string | Yes |
| `permalink_url` | string | Yes |
| `line_items` | Array[Order Line Item] | Yes |
| `fulfillment` | object (expectations + events) | Yes |
| `adjustments` | Array[Adjustment] | No |
| `totals` | Array[Total] | Yes |

#### Order Line Item

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `item` | Item | Yes |
| `quantity` | object (`total`, `fulfilled`) | Yes |
| `totals` | Array[Total] | Yes |
| `status` | string (derived) | Yes |
| `parent_id` | string | No |

**Status Derivation:**
- If `fulfilled == total` -> "fulfilled"
- Else if `fulfilled > 0` -> "partial"
- Else -> "processing"

#### Expectation

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `line_items` | Array[{id, quantity}] | Yes |
| `method_type` | string (shipping/pickup/digital) | Yes |
| `destination` | Postal Address | Yes |
| `description` | string | No |
| `fulfillable_on` | string ("now" or ISO 8601) | No |

#### Fulfillment Event

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `occurred_at` | string (RFC 3339) | Yes |
| `type` | string (open) | Yes |
| `line_items` | Array[{id, quantity}] | Yes |
| `tracking_number` | string | No (required if type != processing) |
| `tracking_url` | string | No |
| `carrier` | string | No |
| `description` | string | No |

**Common Fulfillment Event Types:** `processing`, `shipped`, `in_transit`, `delivered`, `failed_attempt`, `canceled`, `undeliverable`, `returned_to_sender`

#### Adjustment

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `type` | string (open) | Yes |
| `occurred_at` | string (RFC 3339) | Yes |
| `status` | string (pending/completed/failed) | Yes |
| `line_items` | Array[{id, quantity}] | No |
| `amount` | integer (minor units) | No |
| `description` | string | No |

**Common Adjustment Types:** `refund`, `return`, `credit`, `price_adjustment`, `dispute`, `cancellation`

### 7.3 Webhook

**Method:** `POST` to platform-provided URL

**Webhook Inputs (same as Order + event metadata):**
- All Order fields
- `event_id` (string, required): Unique event identifier
- `created_time` (string, RFC 3339, required): Event timestamp

**Configuration:**
```json
{
  "dev.ucp.shopping.order": [{
    "version": "2026-01-23",
    "config": {
      "webhook_url": "https://platform.example.com/webhooks/ucp/orders"
    }
  }]
}
```

### 7.4 Webhook Signature Verification

**Business (Signing):**
1. Select key from `signing_keys` array
2. Create detached JWT (RFC 7797) over request body
3. Include JWT in `Request-Signature` header
4. Include key ID in JWT header's `kid` claim

**Platform (Verification):**
1. Extract `Request-Signature` header
2. Parse JWT header to retrieve `kid`
3. Fetch business's UCP profile from `/.well-known/ucp`
4. Locate key in `signing_keys` with matching `kid`
5. Verify JWT signature against request body
6. Reject webhook if verification fails

**Key Rotation:** Multiple keys supported. Add new key, start signing with it, verifiers locate by `kid`, remove old key after sufficient time.

---

## 8. Identity Linking Capability

**URL:** https://ucp.dev/latest/specification/identity-linking/
**Capability Name:** `dev.ucp.common.identity_linking`

### 8.1 MUST Requirements (Platform)

1. **MUST** authenticate using `client_id` and `client_secret` through HTTP Basic Authentication (RFC 7617) when exchanging codes for tokens.
2. **MUST** implement the OAuth 2.0 Authorization Code flow (RFC 6749 4.1) as the primary linking mechanism.

### 8.2 SHOULD Requirements (Platform)

1. **SHOULD** include a unique, unguessable state parameter in the authorization request to prevent CSRF.
2. **SHOULD** call the business's revocation endpoint (RFC 7009) when a user initiates an unlink action.
3. **SHOULD** support OpenID RISC Profile 1.0 for asynchronous account updates.

### 8.3 MAY Requirements (Platform)

1. **MAY** support Client Metadata.
2. **MAY** support Dynamic Client Registration mechanisms.

### 8.4 MUST Requirements (Business)

1. **MUST** implement OAuth 2.0 (RFC 6749).
2. **MUST** adhere to RFC 8414 to declare OAuth 2.0 endpoints at `/.well-known/oauth-authorization-server`.
3. **MUST** enforce Client Authentication at the Token Endpoint.
4. **MUST** provide an account creation flow if the user does not already have an account.
5. **MUST** support standard UCP scopes.
6. **MUST** implement standard Token Revocation (RFC 7009).
7. **MUST** revoke the specified token; revoking a `refresh_token` **MUST** also immediately revoke all active `access_token`s issued from it.
8. **MUST** support revocation requests authenticated with the same client credentials used for the token endpoint.

### 8.5 SHOULD Requirements (Business)

1. **SHOULD** implement RFC 9728 (HTTP Resource Metadata) to allow platforms to discover the Authorization Server.
2. **SHOULD** fill in `scopes_supported` as part of RFC 8414.
3. **SHOULD** recursively revoke all associated tokens.
4. **SHOULD** support OpenID RISC Profile 1.0 for Cross-Account Protection.

### 8.6 MAY Requirements (Business)

1. Additional permissions **MAY** be granted beyond those explicitly requested.
2. The platform and business **MAY** define additional custom scopes.

### 8.7 Scopes

| Resource | Operation | Scope |
|----------|-----------|-------|
| CheckoutSession | Get | `ucp:scopes:checkout_session` |
| CheckoutSession | Create | `ucp:scopes:checkout_session` |
| CheckoutSession | Update | `ucp:scopes:checkout_session` |
| CheckoutSession | Delete | `ucp:scopes:checkout_session` |
| CheckoutSession | Cancel | `ucp:scopes:checkout_session` |
| CheckoutSession | Complete | `ucp:scopes:checkout_session` |

### 8.8 Authorization Server Metadata (RFC 8414)

```json
{
  "issuer": "https://merchant.example.com",
  "authorization_endpoint": "https://merchant.example.com/oauth2/authorize",
  "token_endpoint": "https://merchant.example.com/oauth2/token",
  "revocation_endpoint": "https://merchant.example.com/oauth2/revoke",
  "scopes_supported": ["ucp:scopes:checkout_session"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic"],
  "service_documentation": "https://merchant.example.com/docs/oauth2"
}
```

---

## 9. REST Binding

**URL:** https://ucp.dev/latest/specification/checkout-rest/

### 9.1 MUST Requirements

1. "All request and response bodies **MUST** be valid JSON as specified in RFC 8259."
2. "All REST endpoints **MUST** be served over HTTPS with minimum TLS version 1.3."
3. "All requests **MUST** include the `UCP-Agent` header containing the platform profile URI using Dictionary Structured Field syntax (RFC 8941)."
4. Servers **MUST** store idempotency keys with operation results for at least 24 hours.
5. Servers **MUST** return the cached result for duplicate idempotency keys.
6. Servers **MUST** return `409 Conflict` if the idempotency key is reused with different parameters.

### 9.2 SHOULD Requirements

1. "Operations that modify state **SHOULD** support idempotency."

### 9.3 MAY Requirements

1. "The REST transport **MAY** use: Open API, API Keys, OAuth 2.0, or Mutual TLS."
2. "Businesses **MAY** require authentication for some operations while leaving others open."

### 9.4 HTTP Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create Checkout | POST | `/checkout-sessions` |
| Get Checkout | GET | `/checkout-sessions/{id}` |
| Update Checkout | PUT | `/checkout-sessions/{id}` |
| Complete Checkout | POST | `/checkout-sessions/{id}/complete` |
| Cancel Checkout | POST | `/checkout-sessions/{id}/cancel` |

### 9.5 Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `UCP-Agent` | Yes | Platform profile URI (RFC 8941 Dictionary) |
| `Authorization` | No | OAuth token (client_credentials or authorization_code) |
| `X-API-Key` | No | Reusable API key allocated by business |
| `Request-Signature` | Yes | Ensure authenticity and integrity |
| `Idempotency-Key` | Yes | Prevents duplicate operations during retries |
| `Request-Id` | Yes | For tracing across network layers |
| `User-Agent` | No | User agent string |
| `Content-Type` | No | Representation metadata |
| `Accept` | No | Content negotiation |
| `Accept-Language` | No | Localization |
| `Accept-Encoding` | No | Compression |

### 9.6 HTTP Status Codes

| Code | Description |
|------|-------------|
| `200 OK` | Request successful |
| `201 Created` | Resource successfully created |
| `400 Bad Request` | Request invalid |
| `401 Unauthorized` | Authentication required/failed |
| `403 Forbidden` | Authenticated but insufficient permissions |
| `404 Not Found` | Resource not found |
| `409 Conflict` | Conflict (e.g., idempotent key reuse) |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server condition |
| `503 Service Unavailable` | Temporary unavailability |

### 9.7 UCP-Agent Header Format

```
UCP-Agent: profile="https://platform.example/profile"
```

### 9.8 Update Checkout Behavior

"All fields in `buyer` are optional, allowing clients to progressively build the checkout state across multiple calls. Each PUT replaces the entire session, so clients must include all previously set fields they wish to retain."

---

## 10. MCP Binding

**URL:** https://ucp.dev/latest/specification/checkout-mcp/

### 10.1 MUST Requirements

1. "MCP clients **MUST** include a `meta` object in every request containing protocol metadata."
2. `meta["ucp-agent"]` -- **Required** on all requests for capability negotiation.
3. `meta["idempotency-key"]` -- **Required** for `complete_checkout` and `cancel_checkout`.
4. A conforming MCP implementation **MUST** implement JSON-RPC 2.0 protocol correctly.
5. **MUST** provide all core checkout tools.
6. **MUST** handle errors with UCP-specific error codes embedded in JSON-RPC error object.
7. **MUST** validate tool inputs against UCP schemas.
8. **MUST** support HTTP transport with streaming.
9. Requests on existing checkouts: checkout object **MUST NOT** contain `id` (use top-level `id` parameter).

### 10.2 MCP Tools

| Tool | Maps To | Key Input Parameters |
|------|---------|---------------------|
| `create_checkout` | Create Checkout | `checkout` (required) |
| `get_checkout` | Get Checkout | `id` (required) |
| `update_checkout` | Update Checkout | `id` (required), `checkout` (required) |
| `complete_checkout` | Complete Checkout | `meta` (required, with `idempotency-key`), `id` (required), `checkout` (required) |
| `cancel_checkout` | Cancel Checkout | `meta` (required, with `idempotency-key`), `id` (required) |

### 10.3 MCP Error Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "status": "error",
      "errors": [{
        "code": "MERCHANDISE_NOT_AVAILABLE",
        "message": "One or more cart items are not available",
        "severity": "requires_buyer_input",
        "details": { "invalid_items": ["sku_999"] }
      }]
    }
  }
}
```

### 10.4 MCP Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "[tool_name]",
    "arguments": { /* OpenRPC params */ }
  }
}
```

### 10.5 Discovery (MCP Transport)

```json
{
  "ucp": {
    "version": "2026-01-23",
    "services": {
      "dev.ucp.shopping": [{
        "version": "2026-01-23",
        "spec": "https://ucp.dev/2026-01-23/specification/overview",
        "transport": "mcp",
        "schema": "https://ucp.dev/2026-01-23/services/shopping/openrpc.json",
        "endpoint": "https://business.example.com/ucp/mcp"
      }]
    }
  }
}
```

---

## 11. A2A Binding

**URL:** https://ucp.dev/latest/specification/checkout-a2a/

### 11.1 MUST Requirements

1. "The checkout object **MUST** be returned as part of a `DataPart` object with key `a2a.ucp.checkout`."
2. "Platforms must reset the `taskId` once a task reaches terminal state."
3. "Business agents must leverage the `messageId` sent as part of the A2A `Message` to detect duplicate messages from platform retries."
4. "Upon completion of the checkout process, the business agent must return the checkout object containing an `order` attribute with `id` and `permalink_url`."
5. "When AP2 mandates extension is enabled, the business agent must create a detached JWS for the checkout object and must return the generated signature as part of the `DataPart` as `ap2.merchant_authorization`."

### 11.2 Key Data Parts

| Key | Description |
|-----|-------------|
| `a2a.ucp.checkout` | Checkout data |
| `a2a.ucp.checkout.payment` | Payment data |
| `a2a.ucp.checkout.risk_signals` | Risk signals |
| `ap2.merchant_authorization` | Merchant JWS signature |
| `ap2.checkout_mandate` | User signed mandate |

### 11.3 A2A Extension URI

`https://ucp.dev/2026-01-23/specification/reference`

### 11.4 Agent Card Extension

```json
{
  "extensions": [{
    "uri": "https://ucp.dev/2026-01-23/specification/reference",
    "description": "Business agent supporting UCP",
    "params": {
      "capabilities": {
        "dev.ucp.shopping.checkout": [{"version": "2026-01-23"}],
        "dev.ucp.shopping.fulfillment": [{
          "version": "2026-01-23",
          "extends": "dev.ucp.shopping.checkout"
        }]
      }
    }
  }]
}
```

### 11.5 Session Management

- Platforms use `contextId` to preserve session context
- Platforms must reset `taskId` on terminal state
- Current `contextId` can be reused for subsequent interactions
- Both natural language and structured `DataPart` inputs supported

---

## 12. Embedded Checkout Binding

**URL:** https://ucp.dev/latest/specification/embedded-checkout/

### 12.1 MUST Requirements

1. "All ECP messages **MUST** use JSON-RPC 2.0 format."
2. "Each message **MUST** contain: `jsonrpc`: **MUST** be `\"2.0\"`, `method`, `params`."
3. "For requests (messages with `id`), receivers **MUST** respond with either: Success Response or Error Response."
4. "Businesses **MUST** include an embedded service binding with `config.delegate` in checkout responses."
5. "The Embedded Checkout **MUST** indicate accepted delegations in the `ec.ready` request via the `delegate` field."
6. Embedded Checkout "**MUST** fire the appropriate `{action}_request` message when that action is triggered."
7. Embedded Checkout "**MUST** wait for the host's response before proceeding."
8. Embedded Checkout "**MUST NOT** show its own UI for that delegated action."
9. Host "**MUST** respond to every `{action}_request` message it receives."
10. Host "**MUST** respond with an appropriate error if the user cancels."
11. "All business iframes **MUST** be sandboxed to restrict their capabilities."
12. "Businesses **MUST** validate authentication according to their security requirements."
13. "All query parameter values must be properly URL-encoded per RFC 3986."
14. "The host **MUST NOT** silently release a token based solely on the message." (Payment Token)
15. "The host **MUST** create at least one of the following globals: `window.EmbeddedCheckoutProtocolConsumer`." (Native)
16. Business "**MUST** set `frame-ancestors <host_origin>;`" (CSP).
17. "The Embedded Checkout **MUST** treat this update as a PUT-style change by entirely replacing the existing state." (Fulfillment update)

### 12.2 SHOULD Requirements

1. "Before loading the embedded context, the host **SHOULD**: Check `config.delegate` for available delegations, prepare handlers."
2. "The host **SHOULD** only request delegations present in `config.delegate`."
3. "The business **SHOULD NOT** accept delegations not present in `config.delegate`."
4. "**SHOULD** show loading/processing states while handling delegation."
5. "The embedded checkout **SHOULD** block or intercept navigation attempts to URLs outside the checkout flow."
6. "**SHOULD** remove or disable UI elements that would navigate away from checkout."
7. "Hosts **SHOULD** use the `credentialless` attribute on the iframe."
8. "Enforce strict validation of the `origin` for all `postMessage` communications."
9. "The message responder **SHOULD** use error codes mapped to **W3C DOMException** names."

### 12.3 MAY Requirements

1. "The host **MAY** initiate an ECP session by loading the `continue_url` in an embedded context."
2. "Hosts **MAY** respond with an `upgrade` field to update the communication channel." (MessagePort)
3. Navigation "**MAY** be allowed when required for checkout completion: Payment provider redirects, 3D Secure verification, Bank authorization, Identity verification."
4. "The host **MAY** use an intermediate iframe."
5. "A host and business **MAY** negotiate additional capabilities."
6. "The host **MAY** also respond with a `checkout` object."
7. "The embedder **MAY** implement additional navigation restrictions at the container level."

### 12.4 JSON-RPC Methods

#### Handshake
| Method | Direction | Type |
|--------|-----------|------|
| `ec.ready` | Embedded -> Host | Request |

#### Lifecycle
| Method | Direction | Type |
|--------|-----------|------|
| `ec.start` | Embedded -> Host | Notification |
| `ec.complete` | Embedded -> Host | Notification |

#### State Change
| Method | Direction | Type |
|--------|-----------|------|
| `ec.line_items.change` | Embedded -> Host | Notification |
| `ec.buyer.change` | Embedded -> Host | Notification |
| `ec.messages.change` | Embedded -> Host | Notification |
| `ec.payment.change` | Embedded -> Host | Notification |

#### Payment Extension
| Method | Direction | Type |
|--------|-----------|------|
| `ec.payment.instruments_change_request` | Embedded -> Host | Request |
| `ec.payment.credential_request` | Embedded -> Host | Request |

#### Fulfillment Extension
| Method | Direction | Type |
|--------|-----------|------|
| `ec.fulfillment.change` | Embedded -> Host | Notification |
| `ec.fulfillment.address_change_request` | Embedded -> Host | Request |

### 12.5 Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ec_version` | string | Yes | UCP version (YYYY-MM-DD) |
| `ec_auth` | string | No | Authentication token |
| `ec_delegate` | string | No | Comma-delimited delegation list |

### 12.6 Delegation Identifiers

| Identifier | Corresponding Message |
|------------|----------------------|
| `payment.instruments_change` | `ec.payment.instruments_change_request` |
| `payment.credential` | `ec.payment.credential_request` |
| `fulfillment.address_change` | `ec.fulfillment.address_change_request` |

### 12.7 Delegation Narrowing Chain

```
config.delegate >= ec_delegate >= ec.ready delegate
```

### 12.8 Error Codes (EP)

| Code | Description |
|------|-------------|
| `abort_error` | User cancelled the interaction |
| `security_error` | Origin validation failed |
| `not_supported_error` | Payment method not supported |
| `invalid_state_error` | Handshake attempted out of order |
| `not_allowed_error` | Request missing valid User Activation |

### 12.9 Communication Channels

**Web-Based Hosts:** `postMessage` between host and Checkout windows. Optional `MessageChannel` via `ec.ready` response.

**Native Hosts:** Inject globals:
- `window.EmbeddedCheckoutProtocolConsumer` (preferred)
- `window.webkit.messageHandlers.EmbeddedCheckoutProtocolConsumer`

### 12.10 Iframe Sandbox

```html
<iframe sandbox="allow-scripts allow-forms allow-same-origin"></iframe>
```

---

## 13. Payment Handler Guide

**URL:** https://ucp.dev/latest/specification/payment-handler-guide/

### 13.1 Framework Stages

1. **PARTICIPANTS** -- Who participates
2. **PREREQUISITES** -- Onboarding and setup
3. **HANDLER DECLARATION** -- Business advertises configuration
4. **INSTRUMENT ACQUISITION** -- Platform acquires checkout instrument
5. **PROCESSING** -- Participant processes instrument

### 13.2 MUST Requirements

1. "The specification **MUST** define which credential types are accepted by the handler."
2. "If using token credentials, the schema **MUST** include an expiration field (`expiry`, `ttl`, or similar)."
3. "The specification **MUST** define a mapping for common failures (e.g., 'Declined', 'Insufficient Funds', 'Network Error') to standard UCP Error definitions."

### 13.3 SHOULD Requirements

1. Handler specification "**SHOULD** clearly document" what identity is assigned, how it maps to `PaymentIdentity`, what additional configuration is provided, and how prerequisites output is used.
2. "Payment handler specifications do NOT need to define a formal process for instrument acquisition. Instead, the specification **SHOULD** clearly document" how to apply config and create effective credential binding.

### 13.4 MAY Requirements

1. "UCP provides base schemas for universal payment instruments like `card`. Spec authors **MAY** extend any of the base instruments."
2. "Handlers **MAY** define multiple instrument types for different payment flows."
3. "Authors **MAY** extend these schemas to include handler-specific credential context."
4. "Handlers **MAY** define multiple credential types for different instrument flows."

### 13.5 Handler Declaration Variants

| Variant | Context | Purpose |
|---------|---------|---------|
| `business_schema` | `/.well-known/ucp` | Business identity and configuration |
| `platform_schema` | Platform profile URI | Platform identity and support |
| `response_schema` | Checkout/Order API responses | Runtime configuration with merged context |

### 13.6 Base Schemas

| Schema | Description |
|--------|-------------|
| `payment_instrument.json` | Base: id, handler_id, type, billing_address, credential, display |
| `card_payment_instrument.json` | Extends base with display: brand, last_digits, expiry, card art |
| `payment_credential.json` | Base: type discriminator only |
| `token_credential.json` | Token: type + token string |

### 13.7 Card Credential

| Field | Type | Required |
|-------|------|----------|
| `type` | string (constant: "card") | Yes |
| `card_number_type` | string (enum: `fpan`, `network_token`, `dpan`) | Yes |
| `number` | string | No |
| `expiry_month` | integer (1-12) | No |
| `expiry_year` | integer | No |
| `name` | string | No |
| `cvc` | string | No |
| `cryptogram` | string | No |
| `eci_value` | string | No |

### 13.8 Payment Identity

| Field | Type | Required |
|-------|------|----------|
| `access_token` | string | Yes |

---

## 14. Tokenization Guide

**URL:** https://ucp.dev/latest/specification/tokenization-guide/

### 14.1 MUST Requirements

1. "Credentials **MUST** be bound to `checkout_id` and participant `identity` to prevent reuse." (Binding)
2. "The tokenizer **MUST** verify binding matches on `/detokenize`."

### 14.2 Security Requirements

| Requirement | Description |
|-------------|-------------|
| Binding required | Credentials bound to checkout_id and identity |
| Binding verified | Must verify binding before returning credentials |
| Cryptographically random | Secure random generators; unguessable tokens |
| Sufficient length | Minimum 128 bits of entropy |
| Non-reversible | Cannot derive credential from token |
| Scoped | Token only works with your tokenizer |
| Time-limited | TTL appropriate to use case (typically 5-30 min) |
| Single-use preferred | Invalidate after first detokenization when possible |

### 14.3 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tokenize` | Convert source credentials to token |
| POST | `/detokenize` | Convert token back to credentials |

### 14.4 Binding Schema

| Field | Required | Description |
|-------|----------|-------------|
| `checkout_id` | Yes | Checkout session this token is valid for |
| `identity` | Conditional | Participant identity; required when caller acts on behalf of another |

### 14.5 Token Lifecycle Policies

| Policy | Description |
|--------|-------------|
| Single-use | Invalidated after first detokenization (most secure; recommended default) |
| TTL-based | Expires after fixed duration (e.g., 15 min) |
| Session-scoped | Valid for checkout session duration |

### 14.6 Schema URLs

| Resource | URL |
|----------|-----|
| Tokenization OpenAPI | `https://ucp.dev/2026-01-23/handlers/tokenization/openapi.json` |
| Identity Schema | `https://ucp.dev/2026-01-23/schemas/shopping/types/payment_identity.json` |
| Binding Schema | `https://ucp.dev/2026-01-23/schemas/shopping/types/binding.json` |
| Token Credential Schema | `https://ucp.dev/2026-01-23/schemas/shopping/types/token_credential.json` |
| Card Instrument Schema | `https://ucp.dev/2026-01-23/schemas/shopping/types/card_payment_instrument.json` |

---

## 15. Reference (All Schemas)

**URL:** https://ucp.dev/latest/specification/reference/

### 15.1 Capability Schemas

- **Checkout Schema** (`checkout.json`): Full checkout session with all fields
- **Order Schema** (`order.json`): Confirmed transaction with line items, fulfillment, adjustments

### 15.2 Extension Schemas

- **AP2 Mandate Extension** (`ap2_mandate.json`): merchant_authorization, checkout_mandate
- **Buyer Consent Extension** (`buyer_consent.json`): analytics, preferences, marketing, sale_of_data
- **Discount Extension** (`discount.json`): codes, applied, allocations
- **Fulfillment Extension** (`fulfillment.json`): methods, destinations, groups, options, available_methods

### 15.3 Type Schemas

| Schema | Key Fields |
|--------|------------|
| Adjustment | id, type, occurred_at, status, line_items, amount, description |
| Binding | checkout_id, identity |
| Buyer | first_name, last_name, email, phone_number |
| Card Credential | type="card", card_number_type, number, expiry_month, expiry_year, name, cvc, cryptogram, eci_value |
| Card Payment Instrument | type="card" + display (brand, last_digits, expiry, card_art) |
| Context | address_country, address_region, postal_code |
| Expectation | id, line_items, method_type, destination, description, fulfillable_on |
| Fulfillment | methods, available_methods |
| Fulfillment Available Method | type, line_item_ids, fulfillable_on, description |
| Fulfillment Destination | Union: ShippingDestination or RetailLocation |
| Fulfillment Event | id, occurred_at, type, line_items, tracking_number, tracking_url, carrier, description |
| Fulfillment Group | id, line_item_ids, options, selected_option_id |
| Fulfillment Method | id, type, line_item_ids, destinations, selected_destination_id, groups |
| Fulfillment Option | id, title, description, carrier, earliest/latest_fulfillment_time, totals |
| Item | id, title, price, image_url |
| Line Item | id, item, quantity, totals, parent_id |
| Link | type, url, title |
| Message Error | type="error", code, path, content_type, content, severity |
| Message Info | type="info", path, code, content_type, content |
| Message Warning | type="warning", path, code, content (MUST display), content_type |
| Order Confirmation | id, permalink_url |
| Order Line Item | id, item, quantity{total, fulfilled}, totals, status, parent_id |
| Payment Account Info | payment_account_reference |
| Payment Credential | type (discriminator) |
| Payment Identity | access_token |
| Payment Instrument | id, handler_id, type, billing_address, credential, display |
| Postal Address | extended_address, street_address, address_locality, address_region, address_country, postal_code, first_name, last_name, phone_number |
| Retail Location | id, name, address |
| Selected Payment Instrument | (extends Payment Instrument) + selected |
| Shipping Destination | (extends Postal Address) + id |
| Token Credential | type, token |
| Total | type, display_text, amount |

### 15.4 UCP Metadata Schemas

| Schema | Key Fields |
|--------|------------|
| Platform Discovery Profile | version, services, capabilities, payment_handlers |
| Business Discovery Profile | version, services, capabilities, payment_handlers |
| Checkout Response Metadata (ucp) | version, services, capabilities, payment_handlers |
| Order Response Metadata (ucp) | version, services, capabilities, payment_handlers |

### 15.5 Enum Values Summary

**Checkout Status:** `incomplete`, `requires_escalation`, `ready_for_complete`, `complete_in_progress`, `completed`, `canceled`

**Total Type:** `items_discount`, `subtotal`, `discount`, `fulfillment`, `tax`, `fee`, `total`

**Message Type:** `error`, `warning`, `info`

**Error Severity:** `recoverable`, `requires_buyer_input`, `requires_buyer_review`

**Link Type:** `privacy_policy`, `terms_of_service`, `refund_policy`, `shipping_policy`, `faq`

**Fulfillment Method Type:** `shipping`, `pickup`

**Expectation Method Type:** `shipping`, `pickup`, `digital`

**Card Number Type:** `fpan`, `network_token`, `dpan`

**Discount Method:** `each`, `across`

**Adjustment Type:** `refund`, `return`, `credit`, `price_adjustment`, `dispute`, `cancellation`

**Adjustment Status:** `pending`, `completed`, `failed`

**Order Line Item Status:** `processing`, `partial`, `fulfilled`

**Fulfillment Event Type:** `processing`, `shipped`, `in_transit`, `delivered`, `failed_attempt`, `canceled`, `undeliverable`, `returned_to_sender`

**Warning Codes:** `final_sale`, `prop65`, `fulfillment_changed`, `age_restricted`

**Error Codes (Checkout):** `missing`, `invalid`, `out_of_stock`, `payment_declined`, `requires_sign_in`, `requires_3ds`, `requires_identity_linking`

**Error Codes (Discount):** `discount_code_expired`, `discount_code_invalid`, `discount_code_already_applied`, `discount_code_combination_disallowed`, `discount_code_user_not_logged_in`, `discount_code_user_ineligible`

**Error Codes (AP2):** `mandate_required`, `agent_missing_key`, `mandate_invalid_signature`, `mandate_expired`, `mandate_scope_mismatch`, `merchant_authorization_invalid`, `merchant_authorization_missing`

**Error Codes (EP):** `abort_error`, `security_error`, `not_supported_error`, `invalid_state_error`, `not_allowed_error`

**AP2 Signature Algorithms:** `ES256`, `ES384`, `ES512`

---

## Referenced Standards

| Standard | Usage |
|----------|-------|
| RFC 2119 / RFC 8174 | Requirement keywords (MUST, SHOULD, MAY) |
| RFC 3339 | Date/time format |
| RFC 3986 | URI encoding |
| RFC 6749 | OAuth 2.0 |
| RFC 7009 | Token Revocation |
| RFC 7515 | JSON Web Signature (JWS) |
| RFC 7617 | HTTP Basic Authentication |
| RFC 7797 | JWS Detached Content |
| RFC 8259 | JSON |
| RFC 8414 | OAuth 2.0 Authorization Server Metadata |
| RFC 8785 | JSON Canonicalization Scheme (JCS) |
| RFC 8941 | Structured Field Values for HTTP |
| RFC 9535 | JSONPath |
| RFC 9728 | HTTP Resource Metadata |
| ISO 3166-1 | Country codes |
| ISO 4217 | Currency codes |
| ISO 8601 | Date/time format |
| E.164 | Phone number format |
| PCI-DSS | Payment Card Industry Data Security Standard |
| GDPR | General Data Protection Regulation |
| CCPA | California Consumer Privacy Act |
| OpenID RISC Profile 1.0 | Cross-Account Protection |
| W3C DOMException | Error code mapping for EP binding |
| JSON-RPC 2.0 | MCP and EP transport protocol |
