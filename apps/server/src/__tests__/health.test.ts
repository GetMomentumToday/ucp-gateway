import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { createAppContainer } from '../container/index.js';
import type { Env } from '../config/env.js';

const testEnv: Env = {
  PORT: 0,
  LOG_LEVEL: 'error',
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://ucp:ucp@localhost:5432/ucp',
  REDIS_URL: 'redis://localhost:6379',
  SECRET_KEY: 'test_secret_key_at_least_32_characters',
};

describe('Health routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const container = createAppContainer(testEnv);
    app = await buildApp({ container });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 with status ok and version', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body).toEqual({
      status: 'ok',
      version: '0.1.0',
    });
  });

  it('GET /ready returns 200 with status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body).toEqual({ status: 'ok' });
  });
});
