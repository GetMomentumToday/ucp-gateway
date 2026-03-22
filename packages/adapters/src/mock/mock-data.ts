import type { Product, UCPProfile } from '@ucp-middleware/core';

export const MOCK_PROFILE: UCPProfile = {
  ucp: '2026-01-11',
  name: 'Mock Store',
  capabilities: [
    { name: 'catalog.search', version: '1.0' },
    { name: 'catalog.product', version: '1.0' },
    { name: 'cart.manage', version: '1.0' },
    { name: 'checkout.complete', version: '1.0' },
    { name: 'order.read', version: '1.0' },
  ],
  links: [
    { rel: 'catalog', href: '/ucp/products' },
    { rel: 'checkout', href: '/ucp/checkout-sessions' },
  ],
  signing_keys: [],
};

export const MOCK_PRODUCTS: readonly Product[] = [
  {
    id: 'prod-001',
    title: 'Running Shoes Pro',
    description: 'High-performance running shoes with advanced cushioning.',
    price: 12999,
    currency: 'USD',
    in_stock: true,
    stock_quantity: 50,
    images: ['https://mock.store/images/shoes-pro-1.jpg'],
    variants: [
      { id: 'var-001a', title: 'Size 9', price: 12999, in_stock: true, attributes: { size: '9' } },
      { id: 'var-001b', title: 'Size 10', price: 12999, in_stock: true, attributes: { size: '10' } },
    ],
  },
  {
    id: 'prod-002',
    title: 'Casual Sneakers',
    description: 'Comfortable everyday sneakers with breathable mesh upper.',
    price: 7999,
    currency: 'USD',
    in_stock: true,
    stock_quantity: 120,
    images: ['https://mock.store/images/sneakers-1.jpg'],
    variants: [
      { id: 'var-002a', title: 'White / Size 9', price: 7999, in_stock: true, attributes: { color: 'white', size: '9' } },
      { id: 'var-002b', title: 'Black / Size 10', price: 7999, in_stock: true, attributes: { color: 'black', size: '10' } },
    ],
  },
  {
    id: 'prod-003',
    title: 'Hiking Boots',
    description: 'Waterproof hiking boots with ankle support and Vibram sole.',
    price: 18999,
    currency: 'USD',
    in_stock: true,
    stock_quantity: 30,
    images: ['https://mock.store/images/hiking-boots-1.jpg'],
    variants: [
      { id: 'var-003a', title: 'Size 10', price: 18999, in_stock: true, attributes: { size: '10' } },
    ],
  },
  {
    id: 'prod-004',
    title: 'Leather Loafers',
    description: 'Classic Italian leather loafers for formal occasions.',
    price: 24999,
    currency: 'USD',
    in_stock: true,
    stock_quantity: 15,
    images: ['https://mock.store/images/loafers-1.jpg'],
    variants: [
      { id: 'var-004a', title: 'Brown / Size 9', price: 24999, in_stock: true, attributes: { color: 'brown', size: '9' } },
    ],
  },
  {
    id: 'prod-005',
    title: 'Sport Sandals',
    description: 'Lightweight sport sandals with adjustable straps.',
    price: 4999,
    currency: 'USD',
    in_stock: true,
    stock_quantity: 200,
    images: ['https://mock.store/images/sandals-1.jpg'],
    variants: [
      { id: 'var-005a', title: 'Size 9', price: 4999, in_stock: true, attributes: { size: '9' } },
    ],
  },
];
