/**
 * UCPM-38: E2E checkout test — MockAdapter full flow.
 * Tests the complete guest checkout journey against MockAdapter.
 * This is the Phase 2 exit criterion.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from './test-helpers.js';

const HEADERS = { host: 'mock-store.localhost', 'ucp-agent': 'test-agent/1.0' };

describe('E2E Checkout: MockAdapter full flow', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const result = await buildTestApp();
    app = result.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes a full checkout journey', async () => {
    // 1. GET /.well-known/ucp — valid profile
    const profileRes = await app.inject({
      method: 'GET',
      url: '/.well-known/ucp',
      headers: { host: 'mock-store.localhost' },
    });
    expect(profileRes.statusCode).toBe(200);
    const profile = JSON.parse(profileRes.body) as Record<string, unknown>;
    expect(profile['ucp']).toBe('2026-01-11');

    // 2. GET /ucp/products?q=shoes — search products
    const searchRes = await app.inject({
      method: 'GET',
      url: '/ucp/products?q=shoes',
      headers: HEADERS,
    });
    expect(searchRes.statusCode).toBe(200);
    const searchBody = JSON.parse(searchRes.body) as { products: { id: string }[] };
    expect(searchBody.products.length).toBeGreaterThan(0);
    const productId = searchBody.products[0]!.id;

    // 3. GET /ucp/products/:id — product detail
    const detailRes = await app.inject({
      method: 'GET',
      url: `/ucp/products/${productId}`,
      headers: HEADERS,
    });
    expect(detailRes.statusCode).toBe(200);
    const product = JSON.parse(detailRes.body) as { id: string; price: number };
    expect(product.id).toBe(productId);

    // 4. POST /ucp/checkout-sessions — create session
    const createRes = await app.inject({
      method: 'POST',
      url: '/ucp/checkout-sessions',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(createRes.statusCode).toBe(201);
    const session = JSON.parse(createRes.body) as { id: string; status: string };
    expect(session.status).toBe('incomplete');
    const sessionId = session.id;

    // 5. PATCH /ucp/checkout-sessions/:id — add address + shipping
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/ucp/checkout-sessions/${sessionId}`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({
        shipping_address: {
          first_name: 'Jane',
          last_name: 'Doe',
          line1: '123 Main St',
          city: 'Austin',
          postal_code: '78701',
          country: 'US',
        },
      }),
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = JSON.parse(patchRes.body) as { status: string; totals: unknown };
    expect(patched.status).toBe('ready_for_complete');

    // 6. POST /ucp/checkout-sessions/:id/complete — finalize order
    const completeRes = await app.inject({
      method: 'POST',
      url: `/ucp/checkout-sessions/${sessionId}/complete`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({
        payment: { token: 'tok_test_123', provider: 'mock' },
      }),
    });
    expect(completeRes.statusCode).toBe(200);
    const completed = JSON.parse(completeRes.body) as { status: string; order_id: string };
    expect(completed.status).toBe('completed');
    expect(completed.order_id).toBeTruthy();

    // 7. GET /ucp/orders/:orderId — verify order
    const orderRes = await app.inject({
      method: 'GET',
      url: `/ucp/orders/${completed.order_id}`,
      headers: HEADERS,
    });
    expect(orderRes.statusCode).toBe(200);
    const order = JSON.parse(orderRes.body) as { status: string };
    expect(order.status).toBe('processing');
  });

  it('idempotent /complete returns same order_id', async () => {
    // Create and complete a session
    const createRes = await app.inject({
      method: 'POST',
      url: '/ucp/checkout-sessions',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ cart_id: 'mock-cart-0002' }),
    });
    const session = JSON.parse(createRes.body) as { id: string };

    await app.inject({
      method: 'PATCH',
      url: `/ucp/checkout-sessions/${session.id}`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({
        shipping_address: {
          first_name: 'John',
          last_name: 'Smith',
          line1: '456 Oak Ave',
          city: 'Denver',
          postal_code: '80202',
          country: 'US',
        },
      }),
    });

    const complete1 = await app.inject({
      method: 'POST',
      url: `/ucp/checkout-sessions/${session.id}/complete`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ payment: { token: 'tok_test_456', provider: 'mock' } }),
    });
    const first = JSON.parse(complete1.body) as { order_id: string };

    // Call /complete again — should return same order_id
    const complete2 = await app.inject({
      method: 'POST',
      url: `/ucp/checkout-sessions/${session.id}/complete`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ payment: { token: 'tok_test_456', provider: 'mock' } }),
    });
    expect(complete2.statusCode).toBe(200);
    const second = JSON.parse(complete2.body) as { order_id: string };
    expect(second.order_id).toBe(first.order_id);
  });

  it('POST /cancel after create returns cancelled status', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/ucp/checkout-sessions',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const session = JSON.parse(createRes.body) as { id: string };

    const cancelRes = await app.inject({
      method: 'POST',
      url: `/ucp/checkout-sessions/${session.id}/cancel`,
      headers: HEADERS,
    });
    expect(cancelRes.statusCode).toBe(200);
    const cancelled = JSON.parse(cancelRes.body) as { status: string };
    expect(cancelled.status).toBe('cancelled');
  });

  it('GET /ucp/checkout-sessions/:id returns session', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/ucp/checkout-sessions',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const session = JSON.parse(createRes.body) as { id: string };

    const getRes = await app.inject({
      method: 'GET',
      url: `/ucp/checkout-sessions/${session.id}`,
      headers: HEADERS,
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.body) as { id: string; status: string };
    expect(fetched.id).toBe(session.id);
    expect(fetched.status).toBe('incomplete');
  });

  it('returns 404 for unknown session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/ucp/checkout-sessions/nonexistent-id',
      headers: HEADERS,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('returns 409 when completing incomplete session', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/ucp/checkout-sessions',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const session = JSON.parse(createRes.body) as { id: string };

    const res = await app.inject({
      method: 'POST',
      url: `/ucp/checkout-sessions/${session.id}/complete`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ payment: { token: 'tok_test', provider: 'mock' } }),
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_SESSION_STATE');
  });
});
