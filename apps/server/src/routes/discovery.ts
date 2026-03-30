import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PlatformAdapter, PaymentHandler } from '@ucp-gateway/core';

const UCP_VERSION = '2026-01-23';
const PAYMENT_HANDLER_DOMAIN = 'dev.ucp.shopping.checkout';

function toUCPPaymentHandlerEntry(handler: PaymentHandler): Record<string, unknown> {
  return {
    id: handler.id,
    version: UCP_VERSION,
    spec: 'https://ucp.dev/latest/specification/checkout/',
    schema: `https://ucp.dev/${UCP_VERSION}/schemas/shopping/payment-handler.json`,
    config: { name: handler.name, type: handler.type },
  };
}

async function resolvePaymentHandlers(
  adapter: PlatformAdapter,
): Promise<Record<string, readonly Record<string, unknown>[]>> {
  if (!adapter.getSupportedPaymentMethods) return {};
  try {
    const methods = await adapter.getSupportedPaymentMethods();
    if (methods.length === 0) return {};
    return { [PAYMENT_HANDLER_DOMAIN]: methods.map(toUCPPaymentHandlerEntry) };
  } catch {
    return {};
  }
}

export async function discoveryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/.well-known/ucp', async (request: FastifyRequest) => {
    const profile = await request.adapter.getProfile();
    const paymentHandlers = await resolvePaymentHandlers(request.adapter);
    const signingKeys = app.signingService.getPublicKeys();

    const profileHandlers = profile.ucp.payment_handlers ?? {};
    const mergedHandlers =
      Object.keys(profileHandlers).length > 0 ? profileHandlers : paymentHandlers;

    return {
      ucp: {
        ...profile.ucp,
        payment_handlers: mergedHandlers,
      },
      signing_keys: signingKeys,
    };
  });
}
