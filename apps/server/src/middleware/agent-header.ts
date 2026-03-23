import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

const SKIP_PATHS = new Set(['/health', '/ready']);
const RFC_8941_PROFILE_PATTERN = /profile="([^"]+)"/;

function getUrlPath(url: string): string {
  return url.split('?')[0]!;
}

function isPublicEndpoint(path: string): boolean {
  return SKIP_PATHS.has(path) || path.startsWith('/.well-known/');
}

function isValidAgentHeader(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  return true;
}

function extractAgentProfile(header: string): string | null {
  const match = RFC_8941_PROFILE_PATTERN.exec(header);
  return match?.[1] ?? null;
}

export const agentHeaderPlugin = fp(async function agentHeader(
  app: FastifyInstance,
): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = getUrlPath(request.url);
    if (isPublicEndpoint(path)) return;

    const agentHeader = request.headers['ucp-agent'];
    if (!isValidAgentHeader(agentHeader)) {
      void reply.status(401).send({
        messages: [
          {
            type: 'error',
            code: 'INVALID_AGENT',
            content:
              'Missing or invalid UCP-Agent header. Format: profile="https://example.com/agent.json"',
            severity: 'recoverable',
          },
        ],
      });
      return;
    }

    const profileUrl = extractAgentProfile(agentHeader as string);
    if (profileUrl) {
      request.log = request.log.child({ agentProfile: profileUrl });
    }
  });
});
