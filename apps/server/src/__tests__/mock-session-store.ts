/**
 * In-memory SessionStore for tests — no Redis required.
 */

import crypto from 'node:crypto';
import type { CheckoutSession, UpdateSessionData } from '@ucp-middleware/core';

const DEFAULT_TTL_SECONDS = 1800;

export class MockSessionStore {
  private readonly sessions = new Map<string, CheckoutSession>();
  private readonly idempotencyKeys = new Map<string, string>();

  async create(tenantId: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<CheckoutSession> {
    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const session: CheckoutSession = {
      id,
      tenant_id: tenantId,
      cart_id: null,
      status: 'incomplete',
      shipping_address: null,
      billing_address: null,
      totals: null,
      order_id: null,
      idempotency_key: null,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    this.sessions.set(id, session);
    return session;
  }

  async get(id: string): Promise<CheckoutSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async update(id: string, data: UpdateSessionData): Promise<CheckoutSession | null> {
    const existing = this.sessions.get(id);
    if (!existing) return null;

    const updated: CheckoutSession = {
      ...existing,
      ...data,
      id: existing.id,
      tenant_id: existing.tenant_id,
      created_at: existing.created_at,
    };

    this.sessions.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  // Helpers for idempotency testing
  setIdempotencyKey(key: string, sessionId: string): void {
    this.idempotencyKeys.set(key, sessionId);
  }

  getIdempotencyKey(key: string): string | undefined {
    return this.idempotencyKeys.get(key);
  }
}
