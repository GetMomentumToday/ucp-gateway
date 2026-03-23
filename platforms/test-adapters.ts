/**
 * Quick smoke test for real platform adapters.
 * Run: npx tsx platforms/test-adapters.ts
 *
 * Requires: docker compose -f platforms/docker-compose.platforms.yml up -d
 */

import { MagentoAdapter } from '../packages/adapters/src/magento/MagentoAdapter.ts';

async function getMagentoToken(): Promise<string> {
  const res = await fetch('http://localhost:8080/rest/V1/integration/admin/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'magentorocks1' }),
  });
  const token = await res.text();
  return token.replace(/"/g, '');
}

async function testMagento(): Promise<void> {
  console.log('=== Magento Adapter ===');

  const token = await getMagentoToken();
  const adapter = new MagentoAdapter({
    storeUrl: 'http://localhost:8080',
    apiKey: token,
  });

  // getProfile
  const profile = await adapter.getProfile();
  console.log(`  Profile: ${profile.name} (UCP ${profile.ucp})`);
  console.log(`  Capabilities: ${profile.capabilities.map((c) => c.name).join(', ')}`);

  // searchProducts
  const products = await adapter.searchProducts({ q: 'shoes' });
  console.log(`  Search "shoes": ${products.length} products`);
  for (const p of products) {
    console.log(`    ${p.id.padEnd(20)} ${p.title.padEnd(25)} $${(p.price / 100).toFixed(2)}`);
  }

  // getProduct
  const product = await adapter.getProduct('ucp-shoes-001');
  console.log(`  Get product: ${product.title} ($${(product.price / 100).toFixed(2)})`);
  console.log(`    In stock: ${product.in_stock}, qty: ${product.stock_quantity}`);

  // getProduct — not found
  try {
    await adapter.getProduct('nonexistent-sku');
    console.log('  ERROR: Should have thrown PRODUCT_NOT_FOUND');
  } catch (err) {
    console.log(`  Not found test: ${(err as Error).message.slice(0, 40)}... ✓`);
  }

  console.log('  ✓ Magento adapter working!\n');
}

async function testShopware(): Promise<void> {
  // Dynamic import since ShopwareAdapter may not be compiled yet
  const { ShopwareAdapter } = await import('../packages/adapters/src/shopware/ShopwareAdapter.ts');

  console.log('=== Shopware Adapter ===');

  // Get Store API access key from admin API
  const tokenRes = await fetch('http://localhost:8888/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'password',
      client_id: 'administration',
      username: 'admin',
      password: 'shopware',
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token: string };

  // Get sales channel access key
  const scRes = await fetch('http://localhost:8888/api/search/sales-channel', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ limit: 1 }),
  });
  const scData = (await scRes.json()) as { data: { attributes: { accessKey: string } }[] };
  const accessKey = scData.data[0]?.attributes?.accessKey;

  if (!accessKey) {
    console.log('  ERROR: Could not find sales channel access key');
    return;
  }
  console.log(`  Access key: ${accessKey.slice(0, 15)}...`);

  const adapter = new ShopwareAdapter({
    storeUrl: 'http://localhost:8888',
    accessKey,
  });

  // searchProducts
  const products = await adapter.searchProducts({ q: 'Shoes' });
  console.log(`  Search "Shoes": ${products.length} products`);
  for (const p of products) {
    console.log(
      `    ${p.id.slice(0, 20).padEnd(20)} ${p.title.padEnd(25)} $${(p.price / 100).toFixed(2)}`,
    );
  }

  // getProduct
  if (products.length > 0) {
    const product = await adapter.getProduct(products[0]!.id);
    console.log(`  Get product: ${product.title} ($${(product.price / 100).toFixed(2)})`);
  }

  console.log('  ✓ Shopware adapter working!\n');
}

async function main(): Promise<void> {
  try {
    await testMagento();
  } catch (err) {
    console.error('Magento test failed:', err);
  }

  try {
    await testShopware();
  } catch (err) {
    console.error('Shopware test failed:', err);
  }
}

await main();
