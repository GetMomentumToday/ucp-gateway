import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { CheckoutSession } from '@ucp-middleware/core';

// ── Schemas ──────────────────────────────────────────────────────────────────

const addressSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  postal_code: z.string().min(1),
  region: z.string().optional(),
  country: z.string().length(2),
});

const createSessionSchema = z.object({
  cart_id: z.string().min(1).optional(),
  idempotency_key: z.string().min(1).optional(),
});

const patchSessionSchema = z.object({
  shipping_address: addressSchema.optional(),
  billing_address: addressSchema.optional(),
});

const completeSessionSchema = z.object({
  payment: z.object({
    token: z.string().min(1),
    provider: z.string().min(1),
  }),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function sessionErrorReply(reply: FastifyReply, code: string, message: string, httpStatus: number): FastifyReply {
  return reply.status(httpStatus).send({
    error: { code, message, http_status: httpStatus },
  });
}

function validationErrorReply(reply: FastifyReply, error: z.ZodError): FastifyReply {
  const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return sessionErrorReply(reply, 'VALIDATION_ERROR', message, 400);
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function checkoutRoutes(app: FastifyInstance): Promise<void> {
  // ── UCPM-25: POST /ucp/checkout-sessions ──────────────────────────────

  app.post('/ucp/checkout-sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) return validationErrorReply(reply, parsed.error);

    const sessionStore = app.container.resolve('sessionStore');

    // UCPM-30: Idempotency — check if a session with this key already exists
    if (parsed.data.idempotency_key) {
      // Store idempotency key → session ID mapping in Redis
      const redis = app.container.resolve('redis');
      const idempKey = `idempotency:${request.tenant.id}:${parsed.data.idempotency_key}`;
      const existingId = await redis.get(idempKey);
      if (existingId) {
        const existing = await sessionStore.get(existingId);
        if (existing) return reply.status(200).send(existing);
      }
    }

    const session = await sessionStore.create(request.tenant.id);

    // Update with optional fields
    let result: CheckoutSession | null = session;
    if (parsed.data.cart_id || parsed.data.idempotency_key) {
      const updateFields: Record<string, unknown> = {};
      if (parsed.data.cart_id) updateFields['cart_id'] = parsed.data.cart_id;
      if (parsed.data.idempotency_key) updateFields['idempotency_key'] = parsed.data.idempotency_key;
      result = await sessionStore.update(session.id, updateFields);
    }

    // Store idempotency mapping
    if (parsed.data.idempotency_key) {
      const redis = app.container.resolve('redis');
      const idempKey = `idempotency:${request.tenant.id}:${parsed.data.idempotency_key}`;
      await redis.setex(idempKey, 1800, session.id);
    }

    return reply.status(201).send(result ?? session);
  });

  // ── UCPM-26: PATCH /ucp/checkout-sessions/:id ─────────────────────────

  app.patch<{ Params: { id: string } }>(
    '/ucp/checkout-sessions/:id',
    async (request, reply: FastifyReply) => {
      const parsed = patchSessionSchema.safeParse(request.body);
      if (!parsed.success) return validationErrorReply(reply, parsed.error);

      const sessionStore = app.container.resolve('sessionStore');
      const session = await sessionStore.get(request.params.id);

      if (!session) {
        return sessionErrorReply(reply, 'SESSION_NOT_FOUND', `Session not found: ${request.params.id}`, 404);
      }

      // UCPM-32: Expired session returns 410
      if (session.status === 'expired') {
        return sessionErrorReply(reply, 'SESSION_EXPIRED', 'Checkout session has expired', 410);
      }

      if (session.status !== 'incomplete') {
        return sessionErrorReply(reply, 'INVALID_SESSION_STATE', `Cannot modify session in state: ${session.status}`, 409);
      }

      // Verify tenant ownership
      if (session.tenant_id !== request.tenant.id) {
        return sessionErrorReply(reply, 'SESSION_NOT_FOUND', `Session not found: ${request.params.id}`, 404);
      }

      // Build update
      const updateData: Record<string, unknown> = {};

      if (parsed.data.shipping_address) {
        updateData['shipping_address'] = parsed.data.shipping_address;
      }
      if (parsed.data.billing_address) {
        updateData['billing_address'] = parsed.data.billing_address;
      }

      // If shipping address is set, calculate totals via adapter
      if (parsed.data.shipping_address) {
        try {
          const cartId = session.cart_id;
          if (cartId) {
            const totals = await request.adapter.calculateTotals(cartId, {
              shipping_address: parsed.data.shipping_address,
              billing_address: parsed.data.billing_address,
            });
            updateData['totals'] = totals;
          }
        } catch {
          // If cart totals fail, still proceed — totals will be null
        }
        updateData['status'] = 'ready_for_complete';
      }

      const updated = await sessionStore.update(request.params.id, updateData);
      return reply.status(200).send(updated);
    },
  );

  // ── UCPM-28: POST /ucp/checkout-sessions/:id/complete ──────────────────

  app.post<{ Params: { id: string } }>(
    '/ucp/checkout-sessions/:id/complete',
    async (request, reply: FastifyReply) => {
      const parsed = completeSessionSchema.safeParse(request.body);
      if (!parsed.success) return validationErrorReply(reply, parsed.error);

      const sessionStore = app.container.resolve('sessionStore');
      const session = await sessionStore.get(request.params.id);

      if (!session) {
        return sessionErrorReply(reply, 'SESSION_NOT_FOUND', `Session not found: ${request.params.id}`, 404);
      }

      if (session.status === 'expired') {
        return sessionErrorReply(reply, 'SESSION_EXPIRED', 'Checkout session has expired', 410);
      }

      // Idempotency: if already completed, return existing result
      if (session.status === 'completed' && session.order_id) {
        return reply.status(200).send(session);
      }

      if (session.status !== 'ready_for_complete') {
        return sessionErrorReply(reply, 'INVALID_SESSION_STATE', `Session must be in ready_for_complete state, got: ${session.status}`, 409);
      }

      if (session.tenant_id !== request.tenant.id) {
        return sessionErrorReply(reply, 'SESSION_NOT_FOUND', `Session not found: ${request.params.id}`, 404);
      }

      // Place order via adapter (cart_id may be null for simple checkouts)
      const cartId = session.cart_id ?? '';
      const order = await request.adapter.placeOrder(cartId, parsed.data.payment);

      const completed = await sessionStore.update(request.params.id, {
        status: 'completed',
        order_id: order.id,
      });

      return reply.status(200).send(completed);
    },
  );

  // ── UCPM-29: POST /ucp/checkout-sessions/:id/cancel ────────────────────

  app.post<{ Params: { id: string } }>(
    '/ucp/checkout-sessions/:id/cancel',
    async (request, reply: FastifyReply) => {
      const sessionStore = app.container.resolve('sessionStore');
      const session = await sessionStore.get(request.params.id);

      if (!session) {
        return sessionErrorReply(reply, 'SESSION_NOT_FOUND', `Session not found: ${request.params.id}`, 404);
      }

      if (session.tenant_id !== request.tenant.id) {
        return sessionErrorReply(reply, 'SESSION_NOT_FOUND', `Session not found: ${request.params.id}`, 404);
      }

      if (session.status === 'completed') {
        return sessionErrorReply(reply, 'INVALID_SESSION_STATE', 'Cannot cancel a completed session', 409);
      }

      if (session.status === 'cancelled') {
        return reply.status(200).send(session);
      }

      const cancelled = await sessionStore.update(request.params.id, {
        status: 'cancelled',
      });

      return reply.status(200).send(cancelled);
    },
  );

  // ── GET /ucp/checkout-sessions/:id ────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    '/ucp/checkout-sessions/:id',
    async (request, reply: FastifyReply) => {
      const sessionStore = app.container.resolve('sessionStore');
      const session = await sessionStore.get(request.params.id);

      if (!session) {
        return sessionErrorReply(reply, 'SESSION_NOT_FOUND', `Session not found: ${request.params.id}`, 404);
      }

      if (session.tenant_id !== request.tenant.id) {
        return sessionErrorReply(reply, 'SESSION_NOT_FOUND', `Session not found: ${request.params.id}`, 404);
      }

      return reply.status(200).send(session);
    },
  );

  // ── GET /ucp/orders/:id ───────────────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    '/ucp/orders/:id',
    async (request, reply: FastifyReply) => {
      try {
        const order = await request.adapter.getOrder(request.params.id);
        return reply.status(200).send(order);
      } catch (err) {
        if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'ORDER_NOT_FOUND') {
          return sessionErrorReply(reply, 'ORDER_NOT_FOUND', `Order not found: ${request.params.id}`, 404);
        }
        throw err;
      }
    },
  );
}
