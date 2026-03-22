import type {
  Cart,
  CheckoutContext,
  LineItem,
  Order,
  PaymentToken,
  Product,
  SearchQuery,
  Totals,
  UCPProfile,
} from './commerce.js';

/**
 * The contract every platform adapter must satisfy.
 * All Core Services call only these methods. The interface must remain
 * stable — changes after adapters are implemented are expensive.
 */
export interface PlatformAdapter {
  /** Human-readable platform identifier, e.g. "magento", "shopware", "shopify" */
  readonly name: string;

  /**
   * Return the UCP Business Profile for this store.
   * The profile tells AI agents what the store supports.
   */
  getProfile(): Promise<UCPProfile>;

  /**
   * Search products matching the given query.
   * Must return an empty array (not throw) when no products match.
   */
  searchProducts(query: SearchQuery): Promise<readonly Product[]>;

  /**
   * Retrieve a single product by its platform-native ID.
   * Must throw a typed error with code PRODUCT_NOT_FOUND for unknown IDs.
   */
  getProduct(id: string): Promise<Product>;

  /**
   * Create a new empty cart on the platform.
   * Returns the cart with a generated ID.
   */
  createCart(): Promise<Cart>;

  /**
   * Add one or more line items to an existing cart.
   * Must validate stock availability; throw OUT_OF_STOCK if insufficient.
   */
  addToCart(cartId: string, items: readonly LineItem[]): Promise<Cart>;

  /**
   * Calculate shipping, tax, and totals for a cart given checkout context.
   * The adapter must call its platform's native totals/tax engine.
   */
  calculateTotals(cartId: string, ctx: CheckoutContext): Promise<Totals>;

  /**
   * Place an order from an existing cart.
   * The payment token is passed through to the platform's payment gateway.
   * Must be idempotent if called with the same cart+payment pair.
   */
  placeOrder(cartId: string, payment: PaymentToken): Promise<Order>;

  /**
   * Retrieve an order by its platform-native ID.
   * Must throw a typed error with code ORDER_NOT_FOUND for unknown IDs.
   */
  getOrder(id: string): Promise<Order>;
}
