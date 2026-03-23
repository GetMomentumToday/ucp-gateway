import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export const requestIdPlugin = fp(async function requestId(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const requestId = request.headers['request-id'];
    if (typeof requestId === 'string' && requestId.length > 0) {
      request.log = request.log.child({ requestId });
    }
  });
});
