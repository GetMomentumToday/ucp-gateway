/**
 * Normalised commerce domain types shared across all adapters.
 * All monetary values are integers in the smallest currency unit (cents).
 * All types are immutable.
 * Field names follow UCP spec at https://ucp.dev/latest/specification/
 */

export interface UCPProfile {
  readonly ucp: {
    readonly version: string;
    readonly services: Readonly<Record<string, readonly UCPService[]>>;
    readonly capabilities: Readonly<Record<string, readonly UCPCapabilityRef[]>>;
    readonly payment_handlers: Readonly<Record<string, readonly UCPPaymentHandlerRef[]>>;
  };
  readonly signing_keys: readonly JsonWebKey[];
}

export interface UCPService {
  readonly version: string;
  readonly spec: string;
  readonly endpoint: string;
  readonly schema: string;
  readonly transport: 'rest' | 'mcp' | 'a2a' | 'embedded';
}

export interface UCPCapabilityRef {
  readonly version: string;
  readonly config?: Readonly<Record<string, unknown>> | undefined;
}

export interface UCPPaymentHandlerRef {
  readonly id: string;
  readonly version: string;
}

export interface JsonWebKey {
  readonly kty: string;
  readonly kid: string;
  readonly [key: string]: unknown;
}

export interface Product {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly price_cents: number;
  readonly currency: string;
  readonly in_stock: boolean;
  readonly stock_quantity: number;
  readonly images: readonly string[];
  readonly variants: readonly ProductVariant[];
}

export interface ProductVariant {
  readonly id: string;
  readonly title: string;
  readonly price_cents: number;
  readonly in_stock: boolean;
  readonly attributes: Readonly<Record<string, string>>;
}

export interface SearchQuery {
  readonly q: string;
  readonly category?: string | undefined;
  readonly min_price_cents?: number | undefined;
  readonly max_price_cents?: number | undefined;
  readonly in_stock?: boolean | undefined;
  readonly limit?: number | undefined;
  readonly page?: number | undefined;
}

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
  readonly unit_price_cents: number;
}

export interface CheckoutContext {
  readonly shipping_address: PostalAddress;
  readonly billing_address?: PostalAddress | undefined;
}

export interface Total {
  readonly type: TotalType;
  readonly amount: number;
  readonly display_text?: string | undefined;
}

export type TotalType =
  | 'items_discount'
  | 'subtotal'
  | 'discount'
  | 'fulfillment'
  | 'tax'
  | 'fee'
  | 'total';

export interface PostalAddress {
  readonly first_name?: string | undefined;
  readonly last_name?: string | undefined;
  readonly street_address?: string | undefined;
  readonly extended_address?: string | undefined;
  readonly address_locality?: string | undefined;
  readonly address_region?: string | undefined;
  readonly postal_code?: string | undefined;
  readonly address_country?: string | undefined;
  readonly phone_number?: string | undefined;
}

export interface PaymentToken {
  readonly token: string;
  readonly provider: string;
}

export interface Order {
  readonly id: string;
  readonly status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  readonly total_cents: number;
  readonly currency: string;
  readonly created_at_iso: string;
}

export interface Buyer {
  readonly first_name?: string | undefined;
  readonly last_name?: string | undefined;
  readonly email?: string | undefined;
  readonly phone_number?: string | undefined;
}

export interface CheckoutLink {
  readonly type: string;
  readonly url: string;
  readonly title?: string | undefined;
}

export interface OrderConfirmation {
  readonly id: string;
  readonly permalink_url: string;
}

export interface UCPMessage {
  readonly type: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly content: string;
  readonly severity?: 'recoverable' | 'requires_buyer_input' | 'requires_buyer_review' | undefined;
  readonly path?: string | undefined;
  readonly content_type?: 'plain' | 'markdown' | undefined;
}
