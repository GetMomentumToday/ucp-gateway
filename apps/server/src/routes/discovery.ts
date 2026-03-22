import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * UCPM-14: GET /.well-known/ucp — UCP Business Profile discovery endpoint.
 * AI agents call this first to understand what the store supports.
 */
export async function discoveryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/.well-known/ucp', async (request: FastifyRequest) => {
    const profile = await request.adapter.getProfile();
    return profile;
  });
}
