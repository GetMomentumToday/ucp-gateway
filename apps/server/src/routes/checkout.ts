import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AdapterError, EscalationRequiredError, type CheckoutSession } from '@ucp-gateway/core';
import {
  sendSessionError,
  isSessionExpired,
  isSessionOwnedByTenant,
  hasSessionAlreadyCompleted,
  checkIdempotencyKey,
  storeIdempotencyRecord,
} from './checkout-helpers.js';
import { toPublicCheckoutResponse, type TenantLinkSettings } from './checkout-response.js';
import {
  buildFulfillmentForCreate,
  buildFulfillmentForUpdate,
  computeTotalsWithFulfillment,
} from './fulfillment.js';
import { enrichLineItemsWithPricing, computeCheckoutTotals } from './checkout-pricing.js';
import { createPlatformCart } from './checkout-cart.js';
import { validateFulfillmentSelected, shouldMarkReadyForComplete } from './checkout-validation.js';
import {
  createSessionSchema,
  updateSessionSchema,
  completeSessionSchema,
} from './checkout-schemas.js';

function getTenantLinkSettings(request: FastifyRequest): TenantLinkSettings | undefined {
  const settings = request.tenant?.settings;
  if (settings && typeof settings === 'object') return settings as TenantLinkSettings;
  return undefined;
}

function sendValidationError(reply: FastifyReply, error: z.ZodError): FastifyReply {
  const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return sendSessionError(reply, 'invalid', message, 400);
}

function sendPublic(
  reply: FastifyReply,
  status: number,
  session: CheckoutSession,
  tenantSettings?: TenantLinkSettings,
): FastifyReply {
  return reply.status(status).send(toPublicCheckoutResponse(session, tenantSettings));
}

function extractFulfillmentCost(
  session: CheckoutSession,
  effectiveLineItems: CheckoutSession['line_items'],
  fulfillment: NonNullable<CheckoutSession['fulfillment']>,
): number {
  const fulfillmentTotals = computeTotalsWithFulfillment(
    { ...session, line_items: effectiveLineItems } as CheckoutSession,
    fulfillment,
  );
  const fulfillmentCostEntry = fulfillmentTotals.find((t) => t.type === 'fulfillment');
  return fulfillmentCostEntry?.amount ?? 0;
}

export async function checkoutRoutes(app: FastifyInstance): Promise<void> {
  app.post('/checkout-sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const sessionStore = app.container.resolve('sessionStore');
    const redis = app.container.resolve('redis');
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    if (idempotencyKey) {
      const idempResult = await checkIdempotencyKey(
        redis,
        request.tenant.id,
        idempotencyKey,
        parsed.data,
        reply,
      );
      if (idempResult && 'cached' in idempResult && idempResult.cached) return idempResult.reply;
    }

    const session = await sessionStore.create(request.tenant.id);

    const updateFields: Record<string, unknown> = {};

    const enrichResult = await enrichLineItemsWithPricing(
      request.adapter,
      parsed.data.line_items,
      reply,
    );
    if (!enrichResult.ok) return enrichResult.reply;

    const lineItems = enrichResult.items;
    updateFields['line_items'] = lineItems;

    const cartId = await createPlatformCart(request.adapter, parsed.data.line_items, app.log);
    if (cartId) updateFields['cart_id'] = cartId;

    const { totals: baseTotals } = computeCheckoutTotals(lineItems, undefined, 0);
    updateFields['totals'] = baseTotals;

    if (parsed.data.currency) updateFields['currency'] = parsed.data.currency;
    if (parsed.data.buyer) updateFields['buyer'] = parsed.data.buyer;
    if (parsed.data.payment) updateFields['payment'] = parsed.data.payment;

    if (parsed.data.fulfillment) {
      const buyerEmail = parsed.data.buyer?.email ?? undefined;
      const fulfillment = buildFulfillmentForCreate(
        parsed.data.fulfillment as Record<string, unknown>,
        lineItems,
        buyerEmail,
      );
      if (fulfillment) {
        updateFields['fulfillment'] = fulfillment;
        const totals = computeTotalsWithFulfillment(
          { ...session, line_items: lineItems, fulfillment } as CheckoutSession,
          fulfillment,
        );
        updateFields['totals'] = totals;
        if (shouldMarkReadyForComplete(fulfillment)) {
          updateFields['status'] = 'ready_for_complete';
        }
      }
    }

    const result =
      Object.keys(updateFields).length > 0
        ? await sessionStore.update(session.id, updateFields)
        : session;

    const responseBody = toPublicCheckoutResponse(
      result ?? session,
      getTenantLinkSettings(request),
    );
    if (idempotencyKey) {
      const hash = (await checkIdempotencyKey(
        redis,
        request.tenant.id,
        idempotencyKey,
        parsed.data,
        reply,
      )) as { cached: false; hash: string } | null;
      if (hash && !hash.cached) {
        await storeIdempotencyRecord(
          redis,
          request.tenant.id,
          idempotencyKey,
          hash.hash,
          201,
          JSON.stringify(responseBody),
        );
      }
    }

    return reply.status(201).send(responseBody);
  });

  app.put<{ Params: { id: string } }>(
    '/checkout-sessions/:id',
    async (request, reply: FastifyReply) => {
      const parsed = updateSessionSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const sessionStore = app.container.resolve('sessionStore');
      const session = await sessionStore.get(request.params.id);

      if (!session)
        return sendSessionError(reply, 'missing', `Session not found: ${request.params.id}`, 404);
      if (isSessionExpired(session))
        return sendSessionError(reply, 'SESSION_EXPIRED', 'Checkout session has expired', 410);
      if (session.status !== 'incomplete' && session.status !== 'ready_for_complete')
        return sendSessionError(
          reply,
          'INVALID_SESSION_STATE',
          `Cannot modify session in state: ${session.status}`,
          409,
        );
      if (!isSessionOwnedByTenant(session, request.tenant))
        return sendSessionError(reply, 'missing', `Session not found: ${request.params.id}`, 404);

      const updateData: Record<string, unknown> = {};

      if (parsed.data.line_items) {
        const enrichResult = await enrichLineItemsWithPricing(
          request.adapter,
          parsed.data.line_items,
          reply,
        );
        if (!enrichResult.ok) return enrichResult.reply;
        updateData['line_items'] = enrichResult.items;
      }

      if (parsed.data.buyer) {
        updateData['buyer'] = parsed.data.buyer;
        if (parsed.data.buyer.shipping_address)
          updateData['shipping_address'] = parsed.data.buyer.shipping_address;
        if (parsed.data.buyer.billing_address)
          updateData['billing_address'] = parsed.data.buyer.billing_address;
      }

      const effectiveLineItems =
        (updateData['line_items'] as CheckoutSession['line_items']) ?? session.line_items;

      const discountCodes = parsed.data.discounts?.codes;

      if (parsed.data.fulfillment) {
        const fulfillment = buildFulfillmentForUpdate(
          parsed.data.fulfillment as Record<string, unknown>,
          session,
        );
        if (fulfillment) {
          updateData['fulfillment'] = fulfillment;

          const fulfillmentCost = extractFulfillmentCost(session, effectiveLineItems, fulfillment);
          const { totals, discounts } = computeCheckoutTotals(
            effectiveLineItems,
            discountCodes,
            fulfillmentCost,
          );
          updateData['totals'] = totals;
          if (discounts) updateData['discounts'] = discounts;

          if (shouldMarkReadyForComplete(fulfillment)) {
            updateData['status'] = 'ready_for_complete';
          }
        }
      } else if (discountCodes && discountCodes.length > 0) {
        const existingFulfillment = session.fulfillment;
        const fulfillmentCost = existingFulfillment
          ? extractFulfillmentCost(session, effectiveLineItems, existingFulfillment)
          : 0;

        const { totals, discounts } = computeCheckoutTotals(
          effectiveLineItems,
          discountCodes,
          fulfillmentCost,
        );
        updateData['totals'] = totals;
        if (discounts) updateData['discounts'] = discounts;
      } else if (updateData['line_items'] || updateData['shipping_address']) {
        const existingFulfillment = session.fulfillment;
        const fulfillmentCost = existingFulfillment
          ? extractFulfillmentCost(session, effectiveLineItems, existingFulfillment)
          : 0;

        const { totals } = computeCheckoutTotals(effectiveLineItems, undefined, fulfillmentCost);
        updateData['totals'] = totals;

        if (updateData['shipping_address']) {
          updateData['status'] = 'ready_for_complete';
        }
      }

      const updated = await sessionStore.update(request.params.id, updateData);
      return sendPublic(reply, 200, updated ?? session, getTenantLinkSettings(request));
    },
  );

  app.post<{ Params: { id: string } }>(
    '/checkout-sessions/:id/complete',
    async (request, reply: FastifyReply) => {
      const parsed = completeSessionSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const sessionStore = app.container.resolve('sessionStore');
      const session = await sessionStore.get(request.params.id);

      if (!session)
        return sendSessionError(reply, 'missing', `Session not found: ${request.params.id}`, 404);
      if (isSessionExpired(session))
        return sendSessionError(reply, 'SESSION_EXPIRED', 'Checkout session has expired', 410);
      if (hasSessionAlreadyCompleted(session))
        return sendPublic(reply, 200, session, getTenantLinkSettings(request));
      if (!isSessionOwnedByTenant(session, request.tenant))
        return sendSessionError(reply, 'missing', `Session not found: ${request.params.id}`, 404);

      if (session.status !== 'ready_for_complete' && session.status !== 'complete_in_progress')
        return sendSessionError(
          reply,
          'INVALID_SESSION_STATE',
          `Session must be in ready_for_complete state, got: ${session.status}`,
          409,
        );

      if (!validateFulfillmentSelected(session)) {
        return sendSessionError(
          reply,
          'fulfillment_required',
          'Fulfillment address and option must be selected before completing checkout',
          400,
        );
      }

      const cartId = session.cart_id ?? '';

      const selectedInstrument =
        parsed.data.payment_data ??
        parsed.data.payment?.instruments.find((i) => i.selected) ??
        parsed.data.payment?.instruments[0];

      if (!selectedInstrument) {
        return sendSessionError(reply, 'invalid', 'No payment instrument provided', 400);
      }

      const credentialRecord = selectedInstrument.credential as Record<string, unknown> | undefined;
      const paymentTokenValue = String(
        credentialRecord?.['token'] ?? credentialRecord?.['type'] ?? selectedInstrument.id,
      );

      await sessionStore.update(request.params.id, { status: 'complete_in_progress' });

      const tenantLinks = getTenantLinkSettings(request);

      try {
        const paymentToken = {
          token: paymentTokenValue,
          provider: selectedInstrument.handler_id,
        };
        const placedOrder = await request.adapter.placeOrder(cartId, paymentToken);

        const completed = await sessionStore.update(request.params.id, {
          status: 'completed',
          order: {
            id: placedOrder.id,
            permalink_url: `https://${request.tenant.domain}/orders/${placedOrder.id}`,
          },
        });

        return sendPublic(reply, 200, completed ?? session, tenantLinks);
      } catch (err: unknown) {
        if (err instanceof EscalationRequiredError) {
          const escalated = await sessionStore.update(request.params.id, {
            status: 'requires_escalation',
            escalation: err.escalation,
            continue_url: err.escalation.continue_url,
          });
          return sendPublic(reply, 200, escalated ?? session, tenantLinks);
        }
        throw err;
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/checkout-sessions/:id/cancel',
    async (request, reply: FastifyReply) => {
      const sessionStore = app.container.resolve('sessionStore');
      const session = await sessionStore.get(request.params.id);

      if (!session)
        return sendSessionError(reply, 'missing', `Session not found: ${request.params.id}`, 404);
      if (!isSessionOwnedByTenant(session, request.tenant))
        return sendSessionError(reply, 'missing', `Session not found: ${request.params.id}`, 404);
      if (session.status === 'completed')
        return sendSessionError(
          reply,
          'INVALID_SESSION_STATE',
          'Cannot cancel a completed session',
          409,
        );
      const cancelTenantLinks = getTenantLinkSettings(request);
      if (session.status === 'canceled') return sendPublic(reply, 200, session, cancelTenantLinks);

      const canceled = await sessionStore.update(request.params.id, { status: 'canceled' });
      return sendPublic(reply, 200, canceled ?? session, cancelTenantLinks);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/checkout-sessions/:id',
    async (request, reply: FastifyReply) => {
      const sessionStore = app.container.resolve('sessionStore');
      const session = await sessionStore.get(request.params.id);

      if (!session)
        return sendSessionError(reply, 'missing', `Session not found: ${request.params.id}`, 404);
      if (!isSessionOwnedByTenant(session, request.tenant))
        return sendSessionError(reply, 'missing', `Session not found: ${request.params.id}`, 404);

      return sendPublic(reply, 200, session, getTenantLinkSettings(request));
    },
  );

  app.get<{ Params: { id: string } }>('/orders/:id', async (request, reply: FastifyReply) => {
    try {
      const order = await request.adapter.getOrder(request.params.id);
      return reply.status(200).send(order);
    } catch (err: unknown) {
      if (err instanceof AdapterError && err.code === 'ORDER_NOT_FOUND') {
        return sendSessionError(reply, 'missing', `Order not found: ${request.params.id}`, 404);
      }
      throw err;
    }
  });
}
