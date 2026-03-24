# UCP Spec Gap Analysis — ucp-gateway

> Cross-reference of UCP Specification v2026-01-23 vs our implementation.
> Updated: 2026-03-24

## Legend

- DONE = Fully implemented and tested
- PARTIAL = Implemented but incomplete
- MISSING = Not implemented
- N/A = Not applicable to REST binding

---

## 1. Overview & Discovery

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 1.1 | Profile at `/.well-known/ucp` | MUST | DONE | discovery.ts |
| 1.2 | `ucp.version` in profile | MUST | DONE | 2026-01-23 |
| 1.3 | `ucp.services` keyed by reverse-domain | MUST | DONE | dev.ucp.shopping |
| 1.4 | `ucp.capabilities` in profile | MUST | DONE | checkout, fulfillment, discounts |
| 1.5 | `ucp.payment_handlers` in profile | MUST | DONE | PR #36 |
| 1.6 | `signing_keys` (JWK) in profile | MUST | MISSING | No key generation or publication |
| 1.7 | HTTPS only | MUST | PARTIAL | App doesn't enforce, relies on infra |
| 1.8 | Version negotiation (platform <= business) | MUST | DONE | version-negotiation middleware |
| 1.9 | `version_unsupported` error | MUST | DONE | Returns 400 |
| 1.10 | `ucp` field in every response | MUST | DONE | checkout-response.ts |
| 1.11 | Credentials not echoed in responses | MUST | DONE | No credential echo |
| 1.12 | Dynamic payment handler filtering by cart | MUST | MISSING | Handlers are static per adapter |

## 2. Checkout Capability

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 2.1 | POST /checkout-sessions (create) | MUST | DONE | |
| 2.2 | GET /checkout-sessions/:id (read) | MUST | DONE | |
| 2.3 | PUT /checkout-sessions/:id (update) | MUST | DONE | Full replacement |
| 2.4 | POST .../complete | MUST | DONE | |
| 2.5 | POST .../cancel | MUST | DONE | |
| 2.6 | 6 status states | MUST | DONE | +expired internal |
| 2.7 | Status: incomplete | MUST | DONE | Initial state |
| 2.8 | Status: requires_escalation | MUST | DONE | EscalationRequiredError |
| 2.9 | Status: ready_for_complete | MUST | DONE | When fulfillment selected |
| 2.10 | Status: complete_in_progress | MUST | DONE | During placeOrder |
| 2.11 | Status: completed (terminal) | MUST | DONE | After order placed |
| 2.12 | Status: canceled (terminal) | MUST | DONE | |
| 2.13 | Post-completion immutability | MUST | DONE | Rejects updates |
| 2.14 | continue_url on non-terminal | SHOULD | DONE | PR #37 |
| 2.15 | continue_url null on terminal | MUST | DONE | PR #37 |
| 2.16 | Confirmation email after completion | MUST | MISSING | Relies on platform |
| 2.17 | Deterministic checkout logic | MUST | DONE | Adapter-based pricing |
| 2.18 | line_items with item.id, title, price | MUST | DONE | Enriched from adapter |
| 2.19 | Totals breakdown (subtotal, discount, fulfillment, tax, total) | MUST | PARTIAL | Missing: tax, fee, items_discount |
| 2.20 | Messages array with type/code/content/severity | MUST | DONE | |
| 2.21 | Severity: recoverable | MUST | DONE | |
| 2.22 | Severity: requires_buyer_input | MUST | DONE | PR #34 |
| 2.23 | Severity: requires_buyer_review | MUST | DONE | PR #34 |
| 2.24 | Links: privacy_policy, terms_of_service | MUST | DONE | |
| 2.25 | Links: refund_policy, shipping_policy, faq | SHOULD | MISSING | Only 2 of 5 |
| 2.26 | Payment instruments in response | MUST | PARTIAL | Empty instruments[] |
| 2.27 | Risk signals in complete | MAY | DONE | Schema accepts |

## 3. Fulfillment Extension

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 3.1 | Methods with type (shipping/pickup) | MUST | PARTIAL | Only shipping |
| 3.2 | Destinations (postal address) | MUST | DONE | |
| 3.3 | Destinations (retail location) | SHOULD | MISSING | No pickup locations |
| 3.4 | Groups with line_item_ids | MUST | DONE | |
| 3.5 | Options with title, description, totals | MUST | DONE | |
| 3.6 | selected_destination_id tracking | MUST | DONE | |
| 3.7 | selected_option_id tracking | MUST | DONE | |
| 3.8 | Real options from platform adapter | MUST | DONE | PR #34 |
| 3.9 | supports_multi_group flag | SHOULD | MISSING | |
| 3.10 | allows_multi_destination flag | SHOULD | MISSING | |
| 3.11 | allows_method_combinations flag | SHOULD | MISSING | |
| 3.12 | Contact fields on destinations | SHOULD | MISSING | No phone/email |

## 4. Discounts Extension

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 4.1 | Discount codes input | MUST | DONE | |
| 4.2 | Applied discounts with type/amount | MUST | DONE | |
| 4.3 | Discount allocations per line item | SHOULD | MISSING | No per-item allocation |
| 4.4 | Stacking rules | SHOULD | MISSING | No stacking config |

## 5. Buyer Consent Extension

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 5.1 | Analytics consent field | MAY | MISSING | Extension not implemented |
| 5.2 | Marketing consent field | MAY | MISSING | |
| 5.3 | CCPA opt-out | MAY | MISSING | |

## 6. AP2 Mandates Extension

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 6.1 | JWS signature validation | MAY | MISSING | Extension not implemented |
| 6.2 | SD-JWT mandate support | MAY | MISSING | |

## 7. Order Capability

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 7.1 | Order with checkout_id | MUST | DONE | PR #35 |
| 7.2 | Order with line_items snapshot | MUST | DONE | PR #35 |
| 7.3 | Order with totals | MUST | DONE | PR #35 |
| 7.4 | Order with fulfillment expectations | MUST | DONE | PR #35 |
| 7.5 | Order with empty adjustments[] | MUST | DONE | PR #35 |
| 7.6 | Fulfillment events (shipped, delivered) | MUST | MISSING | No event tracking |
| 7.7 | Webhook delivery to agent | MUST | MISSING | No webhook POST |
| 7.8 | Webhook signed with JWT | MUST | MISSING | No signing |
| 7.9 | Order adjustments (refund, return) | SHOULD | MISSING | Schema exists, no logic |

## 8. Identity Linking

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 8.1 | OAuth 2.0 authorization endpoint | MAY | MISSING | Not implemented |
| 8.2 | Token endpoint | MAY | MISSING | |
| 8.3 | Revocation endpoint | MAY | MISSING | |

## 9. REST Binding

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 9.1 | UCP-Agent header (RFC 8941 Dictionary) | MUST | DONE | agent-header.ts |
| 9.2 | Content-Type: application/json | MUST | DONE | |
| 9.3 | Idempotency-Key header | MUST | DONE | SHA-256 hash check |
| 9.4 | Request-Id header passthrough | MUST | DONE | PR #34 |
| 9.5 | 201 for create | MUST | DONE | |
| 9.6 | 200 for read/update/complete/cancel | MUST | DONE | |
| 9.7 | 400 for validation errors | MUST | DONE | |
| 9.8 | 404 for not found | MUST | DONE | |
| 9.9 | 409 for state conflicts | MUST | DONE | |
| 9.10 | 410 for expired sessions | MUST | DONE | |

## 10-12. MCP / A2A / Embedded Bindings

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 10.1 | MCP JSON-RPC tools | MAY | MISSING | Phase 4+ |
| 11.1 | A2A DataPart keys | MAY | MISSING | Phase 4+ |
| 12.1 | Embedded checkout JSON-RPC | MAY | MISSING | Phase 4+ |

## 13. Payment Handler Guide

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 13.1 | Handler declarations in profile | MUST | DONE | PR #36 |
| 13.2 | 5-stage handler framework | SHOULD | MISSING | Only basic mapping |
| 13.3 | Handler spec/schema URLs | SHOULD | MISSING | No spec URLs |
| 13.4 | config_schema for each handler | SHOULD | MISSING | |
| 13.5 | instrument_schemas | SHOULD | MISSING | |

## 14. Tokenization Guide

| # | Requirement | Level | Status | Notes |
|---|---|---|---|---|
| 14.1 | /tokenize endpoint | MAY | MISSING | Not implemented |
| 14.2 | /detokenize endpoint | MAY | MISSING | |

---

## Summary

| Category | DONE | PARTIAL | MISSING | Total |
|---|---|---|---|---|
| Overview & Discovery | 10 | 1 | 1 | 12 |
| Checkout | 22 | 2 | 3 | 27 |
| Fulfillment | 7 | 1 | 4 | 12 |
| Discounts | 2 | 0 | 2 | 4 |
| Buyer Consent | 0 | 0 | 3 | 3 |
| AP2 Mandates | 0 | 0 | 2 | 2 |
| Order | 5 | 0 | 4 | 9 |
| Identity Linking | 0 | 0 | 3 | 3 |
| REST Binding | 10 | 0 | 0 | 10 |
| MCP/A2A/Embedded | 0 | 0 | 3 | 3 |
| Payment Handler | 1 | 0 | 4 | 5 |
| Tokenization | 0 | 0 | 2 | 2 |
| **TOTAL** | **57** | **4** | **31** | **92** |

**Score: 57/92 (62%) DONE, 4 PARTIAL, 31 MISSING**

Of the 31 missing:
- 13 are MAY (optional extensions: consent, AP2, identity, MCP, A2A, embedded, tokenization)
- 18 are MUST/SHOULD requirements we need to implement

**Effective MUST/SHOULD score: 57/79 (72%)**

---

## Priority Gaps (MUST/SHOULD only)

### Must Fix (blocks spec conformance)
1. signing_keys in profile (JWK)
2. Webhook delivery to agent
3. Webhook JWT signing
4. Fulfillment events on orders
5. Confirmation email (or delegate to platform)
6. Dynamic payment handler filtering

### Should Fix (improves quality)
1. Tax and fee totals types
2. Remaining link types (refund, shipping, faq)
3. Fulfillment config flags
4. Discount allocations per line item
5. Retail location destinations
6. Contact fields on destinations
7. Payment handler spec/schema URLs
8. Payment instrument echo in responses
