import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AwilixContainer } from 'awilix';
import type { Cradle } from '../container/index.js';
import type { Tenant, PlatformAdapter } from '@ucp-middleware/core';

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_PREFIX = 'tenant:domain:';

declare module 'fastify' {
  interface FastifyRequest {
    tenant: Tenant;
    adapter: PlatformAdapter;
  }
  interface FastifyInstance {
    container: AwilixContainer<Cradle>;
  }
}

export async function tenantResolutionPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest('tenant', null);
  app.decorateRequest('adapter', null);

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip for health/ready endpoints
    const url = request.url;
    if (url === '/health' || url === '/ready') {
      return;
    }

    const container = app.container;
    const redis = container.resolve('redis');
    const tenantRepository = container.resolve('tenantRepository');
    const adapterRegistry = container.resolve('adapterRegistry');

    const host = request.hostname;
    if (!host) {
      return reply.status(404).send({
        error: { code: 'UNKNOWN_STORE', message: 'Missing Host header' },
      });
    }

    // Check Redis cache first
    const cacheKey = `${CACHE_PREFIX}${host}`;
    const cached = await redis.get(cacheKey);

    let tenant: Tenant | null;
    if (cached) {
      tenant = JSON.parse(cached) as Tenant;
    } else {
      tenant = await tenantRepository.findByDomain(host);
      if (tenant) {
        await redis.set(cacheKey, JSON.stringify(tenant), 'EX', CACHE_TTL_SECONDS);
      }
    }

    if (!tenant) {
      return reply.status(404).send({
        error: { code: 'UNKNOWN_STORE', message: `No store configured for domain: ${host}` },
      });
    }

    // Resolve adapter for this tenant's platform
    if (!adapterRegistry.has(tenant.platform)) {
      return reply.status(500).send({
        error: { code: 'PLATFORM_ERROR', message: `No adapter for platform: ${tenant.platform}` },
      });
    }

    request.tenant = tenant;
    request.adapter = adapterRegistry.get(tenant.platform);
  });
}
