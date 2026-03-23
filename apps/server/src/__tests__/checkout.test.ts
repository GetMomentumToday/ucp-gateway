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
    const profileRes = await app.inject({
      method: 'GET',
      url: '/.well-known/ucp',
      headers: { host: 'mock-store.localhost' },
    });
    expect(profileRes.statusCode).toBe(200);
    const profile = JSON.parse(profileRes.body) as { ucp: { version: string } };
    expect(profile.ucp.version).toBe('2026-01-23');

    const searchRes = await app.inject({
      method: 'GET',
      url: '/ucp/products?q=shoes',
      headers: HEADERS,
    });
    expect(searchRes.statusCode).toBe(200);
    const searchBody = JSON.parse(searchRes.body) as { products: { id: string }[] };
    expect(searchBody.products.length).toBeGreaterThan(0);

    const createRes = await app.inject({
      method: 'POST',
      url: '/checkout-sessions',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({
        line_items: [{ item: { id: searchBody.products[0]!.id }, quantity: 1 }],
      }),
    });
    expect(createRes.statusCode).toBe(201);
    const session = JSON.parse(createRes.body) as {
      id: string;
      status: string;
      line_items: unknown[];
      ucp: unknown;
    };
    expect(session.status).toBe('incomplete');
    expect(session.line_items).toHaveLength(1);
    expect(session.ucp).toBeDefined();

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/checkout-sessions/${session.id}`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: session.id,
        line_items: [{ item: { id: searchBody.products[0]!.id }, quantity: 1 }],
        buyer: {
          first_name: 'Jane',
          last_name: 'Doe',
          shipping_address: {
            street_address: '123 Main St',
            address_locality: 'Austin',
            postal_code: '78701',
            address_country: 'US',
          },
        },
      }),
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.body) as { status: string };
    expect(updated.status).toBe('ready_for_complete');

    const completeRes = await app.inject({
      method: 'POST',
      url: `/checkout-sessions/${session.id}/complete`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ payment: { token: 'tok_test_123', provider: 'mock' } }),
    });
    expect(completeRes.statusCode).toBe(200);
    const completed = JSON.parse(completeRes.body) as {
      status: string;
      order: { id: string } | null;
    };
    expect(completed.status).toBe('completed');
    expect(completed.order).not.toBeNull();

    if (completed.order) {
      const orderRes = await app.inject({
        method: 'GET',
        url: `/orders/${completed.order.id}`,
        headers: HEADERS,
      });
      expect(orderRes.statusCode).toBe(200);
    }
  });

  it('idempotent /complete returns same order', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/checkout-sessions',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ line_items: [{ item: { id: 'prod-001' }, quantity: 1 }] }),
    });
    const session = JSON.parse(createRes.body) as { id: string };

    await app.inject({
      method: 'PUT',
      url: `/checkout-sessions/${session.id}`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: session.id,
        buyer: {
          shipping_address: {
            street_address: '456 Oak Ave',
            address_locality: 'Denver',
            postal_code: '80202',
            address_country: 'US',
          },
        },
      }),
    });

    const c1 = await app.inject({
      method: 'POST',
      url: `/checkout-sessions/${session.id}/complete`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ payment: { token: 'tok_456', provider: 'mock' } }),
    });
    const first = JSON.parse(c1.body) as { order: { id: string } };

    const c2 = await app.inject({
      method: 'POST',
      url: `/checkout-sessions/${session.id}/complete`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ payment: { token: 'tok_456', provider: 'mock' } }),
    });
    expect(c2.statusCode).toBe(200);
    const second = JSON.parse(c2.body) as { order: { id: string } };
    expect(second.order.id).toBe(first.order.id);
  });

  it('POST /cancel returns cancelled status', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/checkout-sessions',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const session = JSON.parse(createRes.body) as { id: string };

    const cancelRes = await app.inject({
      method: 'POST',
      url: `/checkout-sessions/${session.id}/cancel`,
      headers: HEADERS,
    });
    expect(cancelRes.statusCode).toBe(200);
    const cancelled = JSON.parse(cancelRes.body) as { status: string };
    expect(cancelled.status).toBe('cancelled');
  });

  it('GET /checkout-sessions/:id returns session with ucp envelope', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/checkout-sessions',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const session = JSON.parse(createRes.body) as { id: string };

    const getRes = await app.inject({
      method: 'GET',
      url: `/checkout-sessions/${session.id}`,
      headers: HEADERS,
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.body) as {
      id: string;
      status: string;
      ucp: { version: string };
    };
    expect(fetched.id).toBe(session.id);
    expect(fetched.ucp.version).toBe('2026-01-23');
  });

  it('returns 404 for unknown session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/checkout-sessions/nonexistent-id',
      headers: HEADERS,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { messages: { code: string }[] };
    expect(body.messages[0]!.code).toBe('missing');
  });

  it('returns 409 when completing incomplete session', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/checkout-sessions',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const session = JSON.parse(createRes.body) as { id: string };

    const res = await app.inject({
      method: 'POST',
      url: `/checkout-sessions/${session.id}/complete`,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ payment: { token: 'tok_test', provider: 'mock' } }),
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { messages: { code: string }[] };
    expect(body.messages[0]!.code).toBe('INVALID_SESSION_STATE');
  });
});
