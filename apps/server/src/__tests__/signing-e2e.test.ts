/**
 * UCPM-226: End-to-end signing tests.
 *
 * Exercises the full request signing journey through the real Fastify
 * pipeline: discovery → sign → verify → checkout with signature.
 * Uses Fastify inject() — no external infrastructure required.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from './test-helpers.js';
import {
  SigningService,
  verifyDetachedJws,
  extractKidFromSignature,
  importPublicKeyFromJwk,
} from '@ucp-gateway/core';
import type { JsonWebKey } from '@ucp-gateway/core';

const HOST = { host: 'mock-store.localhost' };
const AGENT = { 'ucp-agent': 'e2e-signing-test/1.0' };
const HEADERS = { ...HOST, ...AGENT };
const JSON_HEADERS = { ...HEADERS, 'content-type': 'application/json' };

describe('E2E Signing: full journey', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const result = await buildTestApp();
    app = result.app;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Journey 1: discover keys → verify gateway can sign ──────────────

  it('journey: fetch profile → extract keys → gateway signs → external verifies', async () => {
    // Step 1: agent discovers the gateway profile
    const profileRes = await app.inject({
      method: 'GET',
      url: '/.well-known/ucp',
      headers: HOST,
    });
    expect(profileRes.statusCode).toBe(200);
    const profile = JSON.parse(profileRes.body) as Record<string, unknown>;

    // Step 2: agent extracts signing keys
    const signingKeys = profile['signing_keys'] as JsonWebKey[];
    expect(signingKeys.length).toBeGreaterThan(0);
    const key = signingKeys[0]!;
    expect(key.kty).toBe('EC');
    expect(key['crv']).toBe('P-256');

    // Step 3: gateway signs an outbound webhook payload
    const webhookPayload = JSON.stringify({
      event: 'order_placed',
      order_id: 'e2e-order-001',
      checkout_id: 'e2e-checkout-001',
      occurred_at: new Date().toISOString(),
    });
    const payloadBytes = new TextEncoder().encode(webhookPayload);
    const signature = await app.signingService.sign(payloadBytes);

    // Step 4: external platform verifies using only the discovery profile keys
    const kid = extractKidFromSignature(signature);
    expect(kid).toBeDefined();
    const matchingKey = signingKeys.find((k) => k.kid === kid);
    expect(matchingKey).toBeDefined();

    const publicKey = await importPublicKeyFromJwk(matchingKey!);
    const result = await verifyDetachedJws(signature, payloadBytes, publicKey);
    expect(result).toEqual({ valid: true, kid });
  });

  // ── Journey 2: tamper detection ─────────────────────────────────────

  it('journey: man-in-the-middle tamper is detected using discovery keys', async () => {
    const profileRes = await app.inject({
      method: 'GET',
      url: '/.well-known/ucp',
      headers: HOST,
    });
    const signingKeys = (JSON.parse(profileRes.body) as Record<string, unknown>)[
      'signing_keys'
    ] as JsonWebKey[];

    const originalPayload = JSON.stringify({ amount: 5000, currency: 'USD' });
    const signature = await app.signingService.sign(new TextEncoder().encode(originalPayload));

    // Attacker modifies the payload in transit
    const tamperedPayload = JSON.stringify({ amount: 50000, currency: 'USD' });

    const kid = extractKidFromSignature(signature)!;
    const matchingKey = signingKeys.find((k) => k.kid === kid)!;
    const publicKey = await importPublicKeyFromJwk(matchingKey);

    const result = await verifyDetachedJws(
      signature,
      new TextEncoder().encode(tamperedPayload),
      publicKey,
    );
    expect(result.valid).toBe(false);
  });

  // ── Journey 3: checkout + signing round-trip ────────────────────────

  it('journey: create checkout → sign the response → verify signature', async () => {
    // Create a checkout session
    const createRes = await app.inject({
      method: 'POST',
      url: '/checkout-sessions',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        line_items: [{ item: { id: 'prod-001' }, quantity: 2 }],
      }),
    });
    expect(createRes.statusCode).toBe(201);

    // Gateway signs the response body (simulating outbound webhook)
    const responseBytes = new TextEncoder().encode(createRes.body);
    const signature = await app.signingService.sign(responseBytes);

    // Verify using discovery keys
    const profileRes = await app.inject({
      method: 'GET',
      url: '/.well-known/ucp',
      headers: HOST,
    });
    const signingKeys = (JSON.parse(profileRes.body) as Record<string, unknown>)[
      'signing_keys'
    ] as JsonWebKey[];
    const verifyResult = await app.signingService.verify(signature, responseBytes, signingKeys);
    expect(verifyResult.valid).toBe(true);
  });

  // ── Journey 4: key stability across requests ────────────────────────

  it('journey: keys do not rotate mid-session', async () => {
    const fetch1 = await app.inject({
      method: 'GET',
      url: '/.well-known/ucp',
      headers: HOST,
    });

    // Create checkout, update, etc
    const createRes = await app.inject({
      method: 'POST',
      url: '/checkout-sessions',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        line_items: [{ item: { id: 'prod-002' }, quantity: 1 }],
      }),
    });
    expect(createRes.statusCode).toBe(201);
    const session = JSON.parse(createRes.body) as { id: string };

    // Update the session
    await app.inject({
      method: 'PUT',
      url: `/checkout-sessions/${session.id}`,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        id: session.id,
        buyer: { email: 'e2e@test.com', first_name: 'E2E', last_name: 'Test' },
      }),
    });

    const fetch2 = await app.inject({
      method: 'GET',
      url: '/.well-known/ucp',
      headers: HOST,
    });

    const keys1 = (JSON.parse(fetch1.body) as Record<string, unknown>)['signing_keys'];
    const keys2 = (JSON.parse(fetch2.body) as Record<string, unknown>)['signing_keys'];
    expect(keys1).toEqual(keys2);
  });

  // ── Journey 5: multiple webhooks all verifiable ─────────────────────

  it('journey: batch of 10 webhook payloads all verify with discovery keys', async () => {
    const profileRes = await app.inject({
      method: 'GET',
      url: '/.well-known/ucp',
      headers: HOST,
    });
    const signingKeys = (JSON.parse(profileRes.body) as Record<string, unknown>)[
      'signing_keys'
    ] as JsonWebKey[];

    const events = [
      'order_placed',
      'order_confirmed',
      'order_shipped',
      'order_delivered',
      'refund_initiated',
      'refund_completed',
      'order_canceled',
      'fulfillment_updated',
      'payment_captured',
      'payment_failed',
    ];

    for (const event of events) {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          event,
          order_id: `ord-${event}`,
          occurred_at: new Date().toISOString(),
        }),
      );
      const sig = await app.signingService.sign(payload);
      const result = await app.signingService.verify(sig, payload, signingKeys);
      expect(result.valid).toBe(true);
    }
  });

  // ── Journey 6: signature header on inbound POST doesn't break flow ──

  it('journey: agent sends signed checkout creation → gateway accepts', async () => {
    const agentSigning = new SigningService({ keyPrefix: 'agent' });
    await agentSigning.initialize();

    const checkoutBody = JSON.stringify({
      line_items: [{ item: { id: 'prod-001' }, quantity: 1 }],
    });
    const bodyBytes = new TextEncoder().encode(checkoutBody);
    const agentSig = await agentSigning.sign(bodyBytes);

    const res = await app.inject({
      method: 'POST',
      url: '/checkout-sessions',
      headers: {
        ...JSON_HEADERS,
        'request-signature': agentSig,
      },
      body: checkoutBody,
    });

    // Gateway should accept — signature verification is best-effort
    expect(res.statusCode).toBe(201);
  });

  it('journey: agent sends invalid signature on POST → gateway still accepts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/checkout-sessions',
      headers: {
        ...JSON_HEADERS,
        'request-signature': 'completely..invalid',
      },
      body: JSON.stringify({
        line_items: [{ item: { id: 'prod-001' }, quantity: 1 }],
      }),
    });

    expect(res.statusCode).toBe(201);
  });

  // ── Journey 7: different tenants get same gateway key ───────────────

  it('journey: profile keys are gateway-level, not adapter-level', async () => {
    const profileRes = await app.inject({
      method: 'GET',
      url: '/.well-known/ucp',
      headers: HOST,
    });
    const keys = (JSON.parse(profileRes.body) as Record<string, unknown>)[
      'signing_keys'
    ] as JsonWebKey[];

    // Keys come from the gateway signing service, not from the adapter
    // So they should match what the signing service exposes directly
    const directKeys = app.signingService.getPublicKeys();
    expect(keys).toEqual(directKeys);
  });

  // ── Journey 8: full checkout with signing at every step ─────────────

  it('journey: full checkout lifecycle with signing at each mutation', async () => {
    const signingKeys = app.signingService.getPublicKeys();

    // Step 1: Create session
    const createRes = await app.inject({
      method: 'POST',
      url: '/checkout-sessions',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        line_items: [{ item: { id: 'prod-001' }, quantity: 1 }],
      }),
    });
    expect(createRes.statusCode).toBe(201);
    const session = JSON.parse(createRes.body) as { id: string; status: string };

    // Sign the create response
    const createSig = await app.signingService.sign(new TextEncoder().encode(createRes.body));
    expect(
      (
        await app.signingService.verify(
          createSig,
          new TextEncoder().encode(createRes.body),
          signingKeys,
        )
      ).valid,
    ).toBe(true);

    // Step 2: Update session with buyer info
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/checkout-sessions/${session.id}`,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        id: session.id,
        buyer: { email: 'lifecycle@test.com', first_name: 'Life', last_name: 'Cycle' },
      }),
    });
    expect(updateRes.statusCode).toBe(200);

    // Sign the update response
    const updateSig = await app.signingService.sign(new TextEncoder().encode(updateRes.body));
    expect(
      (
        await app.signingService.verify(
          updateSig,
          new TextEncoder().encode(updateRes.body),
          signingKeys,
        )
      ).valid,
    ).toBe(true);

    // Step 3: GET session
    const getRes = await app.inject({
      method: 'GET',
      url: `/checkout-sessions/${session.id}`,
      headers: HEADERS,
    });
    expect(getRes.statusCode).toBe(200);

    // Sign the get response
    const getSig = await app.signingService.sign(new TextEncoder().encode(getRes.body));
    expect(
      (await app.signingService.verify(getSig, new TextEncoder().encode(getRes.body), signingKeys))
        .valid,
    ).toBe(true);

    // All three signatures are different (different payloads)
    expect(new Set([createSig, updateSig, getSig]).size).toBe(3);
  });
});
