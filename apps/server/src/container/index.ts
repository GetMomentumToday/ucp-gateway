import {
  createContainer,
  asValue,
  asClass,
  InjectionMode,
  type AwilixContainer,
} from 'awilix';
import Redis, { type Redis as RedisType } from 'ioredis';
import type { Env } from '../config/env.js';
import {
  createDb,
  TenantRepository,
  AdapterRegistry,
  type Database,
} from '@ucp-middleware/core';
import { MockAdapter } from '@ucp-middleware/adapters';

export interface Cradle {
  env: Env;
  db: Database;
  redis: RedisType;
  tenantRepository: TenantRepository;
  adapterRegistry: AdapterRegistry;
}

export function createAppContainer(env: Env): AwilixContainer<Cradle> {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC,
  });

  // Infrastructure
  const db = createDb({ connectionString: env.DATABASE_URL });
  const redis = new Redis.default(env.REDIS_URL, { lazyConnect: true });

  // Adapter registry
  const adapterRegistry = new AdapterRegistry();
  adapterRegistry.register('mock', new MockAdapter());

  container.register({
    env: asValue(env),
    db: asValue(db),
    redis: asValue(redis),
    tenantRepository: asClass(TenantRepository, {
      injector: () => ({ db }),
    }),
    adapterRegistry: asValue(adapterRegistry),
  });

  return container;
}
