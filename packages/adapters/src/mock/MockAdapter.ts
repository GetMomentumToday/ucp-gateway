import type {
  PlatformAdapter,
  UCPProfile,
  SearchQuery,
  Product,
  Cart,
  LineItem,
  CheckoutContext,
  Totals,
  PaymentToken,
  Order,
} from '@ucp-middleware/core';
import { notFound, outOfStock } from '@ucp-middleware/core';
import { MOCK_PRODUCTS, MOCK_PROFILE } from './mock-data.js';

const MAX_STOCK_QUANTITY = 10;
const FLAT_SHIPPING_CENTS = 999;
const TAX_RATE = 0.1;

interface CartState {
  readonly id: string;
  readonly items: readonly LineItem[];
  readonly currency: string;
}

interface OrderState {
  readonly id: string;
  readonly status: 'processing';
  readonly total: number;
  readonly currency: string;
  readonly created_at: string;
}

/**
 * MockAdapter — fake platform adapter for local development and CI.
 * Purely in-memory, deterministic, no external HTTP calls or DB queries.
 */
export class MockAdapter implements PlatformAdapter {
  readonly name = 'mock';

  private readonly carts = new Map<string, CartState>();
  private readonly orders = new Map<string, OrderState>();
  private nextCartId = 1;
  private nextOrderId = 1;

  async getProfile(): Promise<UCPProfile> {
    return MOCK_PROFILE;
  }

  async searchProducts(query: SearchQuery): Promise<readonly Product[]> {
    const q = query.q.toLowerCase();
    const limit = Math.min(query.limit ?? 20, 100);
    const page = query.page ?? 1;

    let filtered = MOCK_PRODUCTS.filter((p) => {
      const matchesText = p.title.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false);
      const matchesStock = query.in_stock === undefined || p.in_stock === query.in_stock;
      const matchesMinPrice = query.min_price === undefined || p.price >= query.min_price;
      const matchesMaxPrice = query.max_price === undefined || p.price <= query.max_price;
      return matchesText && matchesStock && matchesMinPrice && matchesMaxPrice;
    });

    if (query.category) {
      // MockAdapter has no category concept — return all matches
    }

    const start = (page - 1) * limit;
    filtered = filtered.slice(start, start + limit);

    return filtered;
  }

  async getProduct(id: string): Promise<Product> {
    const product = MOCK_PRODUCTS.find((p) => p.id === id);
    if (!product) {
      throw notFound('PRODUCT_NOT_FOUND', id);
    }
    return product;
  }

  async createCart(): Promise<Cart> {
    const id = `mock-cart-${String(this.nextCartId++).padStart(4, '0')}`;
    const cart: CartState = { id, items: [], currency: 'USD' };
    this.carts.set(id, cart);
    return cart;
  }

  async addToCart(cartId: string, items: readonly LineItem[]): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) {
      throw notFound('CART_NOT_FOUND', cartId);
    }

    for (const item of items) {
      if (item.quantity > MAX_STOCK_QUANTITY) {
        throw outOfStock(item.product_id);
      }
      // Validate product exists
      const product = MOCK_PRODUCTS.find((p) => p.id === item.product_id);
      if (!product) {
        throw notFound('PRODUCT_NOT_FOUND', item.product_id);
      }
    }

    const updatedCart: CartState = {
      ...cart,
      items: [...cart.items, ...items],
    };
    this.carts.set(cartId, updatedCart);
    return updatedCart;
  }

  async calculateTotals(cartId: string, _ctx: CheckoutContext): Promise<Totals> {
    const cart = this.carts.get(cartId);
    if (!cart) {
      throw notFound('CART_NOT_FOUND', cartId);
    }

    const subtotal = cart.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const shipping = FLAT_SHIPPING_CENTS;
    const tax = Math.round(subtotal * TAX_RATE);
    const total = subtotal + shipping + tax;

    return { subtotal, shipping, tax, total, currency: cart.currency };
  }

  async placeOrder(cartId: string, payment: PaymentToken): Promise<Order> {
    if (!payment.token) {
      throw new Error('Payment token is required');
    }

    const cart = this.carts.get(cartId);
    const subtotal = cart
      ? cart.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
      : 0;
    const total = subtotal + FLAT_SHIPPING_CENTS + Math.round(subtotal * TAX_RATE);

    const id = `mock-order-${String(this.nextOrderId++).padStart(4, '0')}`;
    const order: OrderState = {
      id,
      status: 'processing',
      total,
      currency: cart?.currency ?? 'USD',
      created_at: new Date().toISOString(),
    };
    this.orders.set(id, order);

    return order;
  }

  async getOrder(id: string): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) {
      throw notFound('ORDER_NOT_FOUND', id);
    }
    return order;
  }
}
