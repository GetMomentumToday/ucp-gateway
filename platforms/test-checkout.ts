/**
 * Smoke test for cart + checkout on real platforms.
 * Run: node --experimental-transform-types platforms/test-checkout.ts
 */

import { MagentoAdapter } from '../packages/adapters/dist/magento/MagentoAdapter.js';

async function getMagentoToken(): Promise<string> {
  const res = await fetch('http://localhost:8080/rest/V1/integration/admin/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'magentorocks1' }),
  });
  return (await res.text()).replace(/"/g, '');
}

async function testMagentoCheckout(): Promise<void> {
  console.log('=== Magento Cart + Checkout ===');

  const token = await getMagentoToken();
  const adapter = new MagentoAdapter({ storeUrl: 'http://localhost:8080', apiKey: token });

  const cart = await adapter.createCart();
  console.log(`  Created cart: ${cart.id}`);

  const updatedCart = await adapter.addToCart(cart.id, [
    {
      product_id: 'ucp-shoes-001',
      title: 'Running Shoes Pro',
      quantity: 1,
      unit_price_cents: 12999,
    },
  ]);
  console.log(`  Added ${updatedCart.items.length} item(s) to cart`);

  const totals = await adapter.calculateTotals(cart.id, {
    shipping_address: {
      first_name: 'Jane',
      last_name: 'Doe',
      line1: '123 Main St',
      city: 'Austin',
      postal_code: '78701',
      country_iso2: 'US',
      region: 'TX',
    },
  });
  console.log(
    `  Totals: subtotal=$${(totals.subtotal_cents / 100).toFixed(2)}, shipping=$${(totals.shipping_cents / 100).toFixed(2)}, tax=$${(totals.tax_cents / 100).toFixed(2)}, total=$${(totals.total_cents / 100).toFixed(2)}`,
  );

  const order = await adapter.placeOrder(cart.id, { token: 'test', provider: 'checkmo' });
  console.log(`  Placed order: ${order.id} (status: ${order.status})`);

  console.log('  Magento checkout complete!\n');
}

async function main(): Promise<void> {
  try {
    await testMagentoCheckout();
  } catch (err) {
    console.error('Magento checkout failed:', err);
  }
}

await main();
