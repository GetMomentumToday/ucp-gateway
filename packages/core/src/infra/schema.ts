import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  domain: varchar('domain', { length: 255 }).unique().notNull(),
  platform: varchar('platform', { length: 100 }).notNull(),
  adapterConfig: jsonb('adapter_config').notNull(),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const identityLinks = pgTable('identity_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  platformCustomerId: varchar('platform_customer_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
