/**
 * TenantRepository — data access for the tenants table.
 *
 * All returned objects are immutable (readonly properties).
 * Follows the Repository pattern: findByDomain, findById, create, update.
 */

import { eq } from 'drizzle-orm';
import { tenants } from './schema.js';
import type { Database } from './db.js';

/** Immutable tenant record as returned by the repository. */
export interface Tenant {
  readonly id: string;
  readonly slug: string;
  readonly domain: string;
  readonly platform: string;
  readonly adapterConfig: unknown;
  readonly settings: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Payload for creating a new tenant. */
export interface CreateTenantInput {
  readonly slug: string;
  readonly domain: string;
  readonly platform: string;
  readonly adapterConfig: unknown;
  readonly settings?: unknown;
}

/** Payload for updating an existing tenant (all fields optional). */
export interface UpdateTenantInput {
  readonly slug?: string;
  readonly domain?: string;
  readonly platform?: string;
  readonly adapterConfig?: unknown;
  readonly settings?: unknown;
}

export class TenantRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /** Find a tenant by its domain. Returns null when not found. */
  async findByDomain(domain: string): Promise<Tenant | null> {
    const rows = await this.db.select().from(tenants).where(eq(tenants.domain, domain)).limit(1);

    const row = rows[0];
    return row ? toTenant(row) : null;
  }

  /** Find a tenant by primary key. Returns null when not found. */
  async findById(id: string): Promise<Tenant | null> {
    const rows = await this.db.select().from(tenants).where(eq(tenants.id, id)).limit(1);

    const row = rows[0];
    return row ? toTenant(row) : null;
  }

  /** Insert a new tenant and return the created record. */
  async create(data: CreateTenantInput): Promise<Tenant> {
    const rows = await this.db
      .insert(tenants)
      .values({
        slug: data.slug,
        domain: data.domain,
        platform: data.platform,
        adapterConfig: data.adapterConfig,
        settings: data.settings ?? {},
      })
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error('Failed to create tenant: no row returned');
    }
    return toTenant(row);
  }

  /** Update a tenant by id and return the updated record. */
  async update(id: string, data: UpdateTenantInput): Promise<Tenant | null> {
    const rows = await this.db
      .update(tenants)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();

    const row = rows[0];
    return row ? toTenant(row) : null;
  }
}

/** Map a raw DB row to an immutable Tenant object. */
function toTenant(row: typeof tenants.$inferSelect): Tenant {
  return Object.freeze({
    id: row.id,
    slug: row.slug,
    domain: row.domain,
    platform: row.platform,
    adapterConfig: row.adapterConfig,
    settings: row.settings,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
