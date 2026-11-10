import {
  pgTable,
  bigserial,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

// The first columns match the tables already created in the user's Supabase project.
// Additional columns are additive and are applied by supabase/migrations/20261107_backend_storage.sql.
export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  phone: text('phone'),
  role: text('role').notNull().default('member'),
  points: integer('points').notNull().default(0),
  name: text('name'),
  whatsapp: text('whatsapp'),
  passwordHash: text('password_hash'),
  joinedAt: timestamp('joined_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  phoneIdx: index('idx_users_phone').on(table.phone),
}));

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  product: text('product').notNull(),
  productId: text('product_id'),
  item: text('item').notNull(),
  itemId: text('item_id'),
  target: text('target').notNull(),
  status: text('status').notNull().default('Menunggu Pembayaran'),
  total: text('total').notNull(),
  totalNum: integer('total_num').default(0),
  uniqueCode: integer('unique_code').default(0),
  payment: text('payment'),
  paymentId: text('payment_id'),
  paymentStatus: text('payment_status').notNull().default('pending'),
  fulfillmentStatus: text('fulfillment_status').notNull().default('pending'),
  whatsapp: text('whatsapp'),
  email: text('email'),
  lineItemsJson: text('line_items_json'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('idx_orders_user_id').on(table.userId),
  statusIdx: index('idx_orders_status').on(table.status),
  createdIdx: index('idx_orders_created_at').on(table.createdAt),
}));

export const customProducts = pgTable('custom_products', {
  id: text('id').primaryKey(),
  dataJson: text('data_json').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  action: text('action').notNull(),
  performedBy: text('performed_by').notNull(),
  targetId: text('target_id'),
  details: jsonb('details').$type<Record<string, unknown> | null>(),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Session tokens are hashed before storage; raw session IDs remain only in the browser cookie.
export const authSessions = pgTable('auth_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  kind: text('kind').notNull(),
  userId: text('user_id'),
  email: text('email').notNull(),
  name: text('name'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  expiryIdx: index('idx_auth_sessions_expires_at').on(table.expiresAt),
  userIdx: index('idx_auth_sessions_user_id').on(table.userId),
}));

export const schema = { users, orders, customProducts, auditLogs, authSessions };
