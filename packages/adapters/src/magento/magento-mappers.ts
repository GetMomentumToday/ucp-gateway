import type { Product, Cart, LineItem, Totals, Order, Address } from '@ucp-middleware/core';
import type { MagentoProduct, MagentoCartItem, MagentoTotals } from './magento-types.js';
import { dollarsToCents } from '../shared/price.js';

export function mapMagentoProduct(item: MagentoProduct, storeUrl: string): Product {
  const description = getCustomAttribute(item, 'description')
    ?? getCustomAttribute(item, 'short_description');
  const stockItem = item.extension_attributes?.stock_item;
  const images = extractProductImages(item, storeUrl);

  return {
    id: item.sku,
    title: item.name,
    description: description ?? null,
    price_cents: dollarsToCents(item.price),
    currency: 'USD',
    in_stock: stockItem?.is_in_stock ?? true,
    stock_quantity: stockItem?.qty ?? 0,
    images,
    variants: [],
  };
}

function getCustomAttribute(item: MagentoProduct, code: string): string | undefined {
  return item.custom_attributes?.find((a) => a.attribute_code === code)?.value;
}

function extractProductImages(item: MagentoProduct, storeUrl: string): readonly string[] {
  return (item.media_gallery_entries ?? [])
    .filter((e) => e.media_type === 'image')
    .map((e) => `${storeUrl}/pub/media/catalog/product${e.file}`);
}

export function mapMagentoCartItems(cartId: string, items: readonly MagentoCartItem[]): Cart {
  const lineItems: readonly LineItem[] = items.map((item) => ({
    product_id: item.sku,
    title: item.name,
    quantity: item.qty,
    unit_price_cents: dollarsToCents(item.price),
  }));

  return {
    id: cartId,
    items: lineItems,
    currency: 'USD',
  };
}

export function mapMagentoTotals(totals: MagentoTotals): Totals {
  return {
    subtotal_cents: dollarsToCents(totals.subtotal),
    shipping_cents: dollarsToCents(totals.shipping_amount),
    tax_cents: dollarsToCents(totals.tax_amount),
    total_cents: dollarsToCents(totals.grand_total),
    currency: totals.base_currency_code,
  };
}

export function mapMagentoOrder(orderId: string, total: number, currency: string): Order {
  return {
    id: orderId,
    status: 'processing',
    total_cents: dollarsToCents(total),
    currency,
    created_at_iso: new Date().toISOString(),
  };
}

export function buildMagentoShippingAddress(address: Address): Record<string, unknown> {
  return {
    firstname: address.first_name,
    lastname: address.last_name,
    street: [address.line1, address.line2].filter(Boolean),
    city: address.city,
    postcode: address.postal_code,
    region_code: address.region ?? '',
    country_id: address.country_iso2,
    telephone: '0000000000',
  };
}
