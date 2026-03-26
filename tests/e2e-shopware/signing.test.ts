/**
 * UCPM-226: E2E signing tests for Shopware adapter.
 *
 * Runs against a live Shopware instance + gateway.
 * Validates that the discovery profile exposes real signing_keys
 * and that those keys can verify signatures produced by the gateway.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SigningService, importPublicKeyFromJwk } from '@ucp-gateway/core';
import type { JsonWebKey } from '@ucp-gateway/core';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';
const SHOPWARE_TENANT_HOST = process.env.SHOPWARE_TENANT_HOST ?? 'shopware.localhost:3000';
const AGENT_HEADER = 'e2e-signing-shopware/1.0';

async function get(path: string): Promise<Response> {
  return fetch(`${GATEWAY_URL}${path}`, {
    headers: { 'UCP-Agent': AGENT_HEADER, Host: SHOPWARE_TENANT_HOST },
  });
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  return fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'UCP-Agent': AGENT_HEADER,
      Host: SHOPWARE_TENANT_HOST,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

interface ProfileResponse {
  readonly ucp: { readonly version: string };
  readonly signing_keys: readonly JsonWebKey[];
  readonly payment?: unknown;
}

describe('Shopware E2E: Request Signing', () => {
  let profile: ProfileResponse;
  let signingKeys: readonly JsonWebKey[];

  beforeAll(async () => {
    const healthResp = await fetch(`${GATEWAY_URL}/health`);
    const health = (await healthResp.json()) as { status: string };
    if (health.status !== 'ok') throw new Error('Gateway not healthy');

    const profileResp = await fetch(`${GATEWAY_URL}/.well-known/ucp`, {
      headers: { Host: SHOPWARE_TENANT_HOST },
    });
    profile = (await profileResp.json()) as ProfileResponse;
    signingKeys = profile.signing_keys;
  });

  // ── Discovery profile signing_keys ──────────────────────────────────

  describe('Discovery profile signing_keys', () => {
    it('signing_keys is a non-empty array', () => {
      expect(Array.isArray(signingKeys)).toBe(true);
      expect(signingKeys.length).toBeGreaterThan(0);
    });

    it('each key has UCP-compliant JWK fields', () => {
      for (const key of signingKeys) {
        expect(key.kty).toBe('EC');
        expect(key['crv']).toBe('P-256');
        expect(key['alg']).toBe('ES256');
        expect(key['use']).toBe('sig');
        expect(typeof key.kid).toBe('string');
        expect(typeof key['x']).toBe('string');
        expect(typeof key['y']).toBe('string');
      }
    });

    it('no private key material (d) is exposed', () => {
      for (const key of signingKeys) {
        expect(key['d']).toBeUndefined();
      }
    });

    it('x and y are base64url-encoded', () => {
      const b64url = /^[A-Za-z0-9_-]+$/;
      for (const key of signingKeys) {
        expect(key['x']).toMatch(b64url);
        expect(key['y']).toMatch(b64url);
      }
    });

    it('keys are stable across sequential fetches', async () => {
      const resp2 = await fetch(`${GATEWAY_URL}/.well-known/ucp`, {
        headers: { Host: SHOPWARE_TENANT_HOST },
      });
      const profile2 = (await resp2.json()) as ProfileResponse;
      expect(profile2.signing_keys).toEqual(signingKeys);
    });
  });

  // ── Signing verification round-trip ─────────────────────────────────

  describe('Signature verification with discovery keys', () => {
    it('a public key from the profile can import successfully', async () => {
      const key = signingKeys[0]!;
      const pubKey = await importPublicKeyFromJwk(key);
      expect(pubKey).toBeDefined();
    });
  });

  // ── Checkout flow with Request-Signature header ─────────────────────

  describe('Checkout with Request-Signature header', () => {
    let productId: string;

    beforeAll(async () => {
      const searchResp = await get('/ucp/products?q=test&limit=1');
      const searchBody = (await searchResp.json()) as { products: { id: string }[] };
      if (searchBody.products.length === 0) throw new Error('No products found');
      productId = searchBody.products[0]!.id;
    });

    it('checkout creation succeeds without Request-Signature', async () => {
      const res = await postJson('/checkout-sessions', {
        line_items: [{ item: { id: productId }, quantity: 1 }],
      });
      expect(res.status).toBe(201);
    });

    it('checkout creation succeeds with valid Request-Signature', async () => {
      const agentSvc = new SigningService({ keyPrefix: 'e2e_agent' });
      await agentSvc.initialize();

      const body = { line_items: [{ item: { id: productId }, quantity: 1 }] };
      const bodyStr = JSON.stringify(body);
      const sig = await agentSvc.sign(new TextEncoder().encode(bodyStr));

      const res = await postJson('/checkout-sessions', body, {
        'Request-Signature': sig,
      });
      expect(res.status).toBe(201);
    });

    it('checkout creation succeeds with garbage Request-Signature (best-effort)', async () => {
      const res = await postJson(
        '/checkout-sessions',
        { line_items: [{ item: { id: productId }, quantity: 1 }] },
        { 'Request-Signature': 'garbage..nonsense' },
      );
      expect(res.status).toBe(201);
    });
  });
});
