/**
 * Normalised commerce domain types shared across all adapters.
 * All prices are in cents (integer). All types are immutable.
 */

// ──────────────────────────────────────────────
// UCP Business Profile
// ──────────────────────────────────────────────

export interface UCPProfile {
  readonly ucp: string; // spec version, e.g. "2026-01-11"
  readonly name: string;
  readonly capabilities: readonly Capability[];
  readonly links: readonly ProfileLink[];
  readonly signing_keys: readonly JsonWebKey[];
}

export interface Capability {
  readonly name: string;
  readonly version: string;
}

export interface ProfileLink {
  readonly rel: string;
  readonly href: string;
}

export interface JsonWebKey {
  readonly kty: string;
  readonly kid: string;
  readonly [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Product
// ──────────────────────────────────────────────

export interface Product {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly price: number; // cents
  readonly currency: string;
  readonly in_stock: boolean;
  readonly stock_quantity: number;
  readonly images: readonly string[];
  readonly variants: readonly ProductVariant[];
}

export interface ProductVariant {
  readonly id: string;
  readonly title: string;
  readonly price: number; // cents
  readonly in_stock: boolean;
  readonly attributes: Readonly<Record<string, string>>;
}

export interface SearchQuery {
  readonly q: string;
  readonly category?: string | undefined;
  readonly min_price?: number | undefined; // cents
  readonly max_price?: number | undefined; // cents
  readonly in_stock?: boolean | undefined;
  readonly limit?: number | undefined; // default 20, max 100
  readonly page?: number | undefined; // default 1
}

// ──────────────────────────────────────────────
// Cart
// ──────────────────────────────────────────────

export interface Cart {
  readonly id: string;
  readonly items: readonly LineItem[];
  readonly currency: string;
}

export interface LineItem {
  readonly product_id: string;
  readonly variant_id?: string;
  readonly title: string;
  readonly quantity: number;
  readonly unit_price: number; // cents
}

// ──────────────────────────────────────────────
// Checkout / Totals
// ──────────────────────────────────────────────

export interface CheckoutContext {
  readonly shipping_address: Address;
  readonly billing_address?: Address | undefined;
}

export interface Totals {
  readonly subtotal: number; // cents
  readonly shipping: number; // cents
  readonly tax: number; // cents
  readonly total: number; // cents
  readonly currency: string;
}

export interface Address {
  readonly first_name: string;
  readonly last_name: string;
  readonly line1: string;
  readonly line2?: string | undefined;
  readonly city: string;
  readonly postal_code: string;
  readonly region?: string | undefined;
  readonly country: string; // ISO 3166-1 alpha-2
}

// ──────────────────────────────────────────────
// Payment
// ──────────────────────────────────────────────

export interface PaymentToken {
  readonly token: string;
  readonly provider: string;
}

// ──────────────────────────────────────────────
// Order
// ──────────────────────────────────────────────

export interface Order {
  readonly id: string;
  readonly status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  readonly total: number; // cents
  readonly currency: string;
  readonly created_at: string; // ISO 8601
}
