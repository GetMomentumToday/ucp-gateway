/**
 * Database connection utility.
 *
 * Creates a Drizzle ORM instance backed by a postgres.js connection pool.
 * Expects DATABASE_URL environment variable to be set.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const DEFAULT_POOL_MAX = 10;

export interface DbConfig {
  readonly connectionString: string;
  readonly poolMax?: number;
}

/**
 * Build a database configuration from environment variables.
 * Throws if DATABASE_URL is not set.
 */
export function buildDbConfig(): DbConfig {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is required but not set',
    );
  }
  return { connectionString };
}

/**
 * Create a Drizzle database instance with the given configuration.
 */
export function createDb(config: DbConfig) {
  const sql = postgres(config.connectionString, {
    max: config.poolMax ?? DEFAULT_POOL_MAX,
  });

  return drizzle(sql, { schema });
}

/** Convenience type for the Drizzle database instance. */
export type Database = ReturnType<typeof createDb>;
