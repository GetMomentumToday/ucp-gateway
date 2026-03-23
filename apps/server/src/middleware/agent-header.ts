import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

const SKIP_PATHS = new Set(['/health', '/ready']);

function getUrlPath(url: string): string {
  return url.split('?')[0]!;
}

function isPublicEndpoint(path: string): boolean {
  return SKIP_PATHS.has(path) || path.startsWith('/.well-known/');
}

function isValidAgentHeader(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export const agentHeaderPlugin = fp(async function agentHeader(
  app: FastifyInstance,
): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = getUrlPath(request.url);
    if (isPublicEndpoint(path)) return;

    if (!isValidAgentHeader(request.headers['ucp-agent'])) {
      void reply.status(401).send({
        messages: [
          {
            type: 'error',
            code: 'INVALID_AGENT',
            content: 'Missing or invalid UCP-Agent header. Format: "agent-name/version"',
            severity: 'recoverable',
          },
        ],
      });
      return;
    }
  });
});
