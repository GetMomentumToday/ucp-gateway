# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Upgraded `@omnixhq/ucp-js-sdk` from v1.1.0-draft.3.1 to v2.0.0 (spec v2026-04-08)
- `OrderSchema` now requires `currency` field — added to `UCPOrder` interface and `handleCompleteSession`
- Order adjustments use `totals[]` array instead of top-level `amount` (SDK 2.0.0 breaking change)
- `OrderLineItemStatus` includes new `'removed'` variant from SDK 2.0.0
- All UCP version strings updated from `2026-01-23` to `2026-04-08`

### Added

- 36-test smoke test suite (`smoke-mock-server.test.ts`) covering full checkout flow, cart CRUD, catalog, session lifecycle, error handling, discovery profile, fulfillment events, and multi-item checkout
- Full alignment with `@omnixhq/ucp-js-sdk` v1.1.0-draft.3.1 — all responses validated through SDK schemas
- `dev.ucp.shopping.order` capability in discovery profile
- Catalog routes (`/ucp/catalog/search`, `/ucp/catalog/lookup/{id}`) with SDK-shaped responses
- Cart CRUD routes (`/ucp/cart`)
- Identity linking routes (`/ucp/identity/*`)
- AP2 mandates middleware
- Version negotiation middleware
- Buyer consent, signals, and embedded checkout extensions
- Payment instruments with 4 handler types (card, wallet, redirect, offline)
- Escalation flow with `requires_escalation` + `continue_url` + embedded config
- Order lifecycle with fulfillment events, adjustments, and fulfilled tracking
- UCP conformance test suite (Python, 222 tests passing)
- Idempotency-Key with SHA-256 hash verification

### Changed

- Repository transferred from `GetMomentumToday/ucp-gateway` to `OmnixHQ/omnix-gateway`
- Paid adapters (Magento, Shopware) split into private `@omnixhq` packages
- Discount capability renamed from `dev.ucp.shopping.discounts` to `dev.ucp.shopping.discount` (singular per UCP spec)
- All checkout responses validated through `CheckoutResponseSchema`
- Order responses validated through `OrderSchema`
- Catalog responses validated through `UcpResponseCatalogSchema`
- Adjustment schema aligned with UCP signed-amount spec

### Removed

- Inline Magento 2.x adapter code (moved to `@omnixhq/adapter-magento`)
- Inline Shopware 6.x adapter code (moved to `@omnixhq/adapter-shopware`)
- Magento/Shopware E2E workflows and test fixtures (moved to private repos)

### Fixed

- Discount capability name `dev.ucp.shopping.discounts` → `dev.ucp.shopping.discount` (clients could not detect discount support)
- Missing `dev.ucp.shopping.order` in discovery profile (clients could not detect order support)
- Discount spec/schema URLs pointed to plural paths
