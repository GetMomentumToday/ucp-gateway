import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    version: '0.1.0',
  }));

  app.get('/ready', async () => {
    // TODO: verify DB and Redis connectivity (UCPM-11, UCPM-12)
    return { status: 'ok' };
  });
}
