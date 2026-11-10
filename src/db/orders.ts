import { db } from './index.js';
import { orders } from './schema.js';
import { desc, eq, or, sql } from 'drizzle-orm';

export interface OrderInput {
  id: string;
  userId?: string | null;
  product: string;
  productId?: string | null;
  item: string;
  itemId?: string | null;
  target: string;
  status: string;
  total: string;
  totalNum?: number | null;
  uniqueCode?: number | null;
  payment?: string | null;
  paymentId?: string | null;
  paymentStatus?: 'pending' | 'verified' | 'rejected';
  fulfillmentStatus?: 'pending' | 'processing' | 'shipped';
  whatsapp?: string | null;
  email?: string | null;
  lineItemsJson?: string | null;
  verifiedAt?: Date | string | null;
  shippedAt?: Date | string | null;
  createdAt?: Date | string | null;
  metadata?: Record<string, unknown> | null;
}

function asDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function mapDbOrder(row: any): any {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    ...metadata,
    id: row.id,
    product: row.product,
    productId: row.productId ?? metadata.productId,
    item: row.item,
    itemId: row.itemId ?? metadata.itemId,
    target: row.target,
    status: row.status,
    total: row.total,
    totalNum: row.totalNum,
    uniqueCode: row.uniqueCode ?? metadata.uniqueCode ?? 0,
    payment: row.payment ?? undefined,
    paymentId: row.paymentId ?? undefined,
    paymentStatus: row.paymentStatus || 'pending',
    fulfillmentStatus: row.fulfillmentStatus || 'pending',
    whatsapp: row.whatsapp ?? undefined,
    email: row.email ?? undefined,
    lineItems: metadata.lineItems ?? (row.lineItemsJson ? safeJson(row.lineItemsJson) : []),
    createdAt: (row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)).toISOString(),
    verifiedAt: row.verifiedAt ? new Date(row.verifiedAt).toISOString() : metadata.verifiedAt,
    shippedAt: row.shippedAt ? new Date(row.shippedAt).toISOString() : metadata.shippedAt,
  };
}

function safeJson(value: string): unknown[] {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

/** Admin listing. Bounded so the response and DB read stay small as orders accumulate. */
export async function getAllDbOrders(limit = 2000) {
  try {
    const safeLimit = Math.max(1, Math.min(10000, Math.floor(limit) || 2000));
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(safeLimit);
    return rows.map(mapDbOrder);
  } catch (error) {
    console.error('Failed to load orders from PostgreSQL:', error);
    throw new Error('Database query failed while loading orders.', { cause: error });
  }
}

export async function getDbOrderById(id: string) {
  try {
    const rows = await db.select().from(orders).where(eq(orders.id, id.toUpperCase())).limit(1);
    return rows[0] ? mapDbOrder(rows[0]) : null;
  } catch (error) {
    console.error('Failed to load order from PostgreSQL:', error);
    throw new Error('Database query failed while loading order.', { cause: error });
  }
}

export async function upsertDbOrder(input: OrderInput) {
  try {
    const totalNum = input.totalNum ?? (Number(String(input.total || '').replace(/[^\d]/g, '')) || 0);
    const createdAt = asDate(input.createdAt) || new Date();
    const result = await db.insert(orders).values({
      id: input.id.toUpperCase(), userId: input.userId || null,
      product: input.product, productId: input.productId || null,
      item: input.item, itemId: input.itemId || null, target: input.target,
      status: input.status, total: input.total, totalNum,
      uniqueCode: input.uniqueCode ?? 0, payment: input.payment || null,
      paymentId: input.paymentId || null,
      paymentStatus: input.paymentStatus || 'pending',
      fulfillmentStatus: input.fulfillmentStatus || 'pending',
      whatsapp: input.whatsapp || null, email: input.email || null,
      lineItemsJson: input.lineItemsJson || null,
      verifiedAt: asDate(input.verifiedAt), shippedAt: asDate(input.shippedAt),
      createdAt, updatedAt: new Date(), metadata: input.metadata || {},
    }).onConflictDoUpdate({
      target: orders.id,
      set: {
        userId: input.userId || null, product: input.product,
        productId: input.productId || null, item: input.item,
        itemId: input.itemId || null, target: input.target,
        status: input.status, total: input.total, totalNum,
        uniqueCode: input.uniqueCode ?? 0, payment: input.payment || null,
        paymentId: input.paymentId || null,
        paymentStatus: input.paymentStatus || 'pending',
        fulfillmentStatus: input.fulfillmentStatus || 'pending',
        whatsapp: input.whatsapp || null, email: input.email || null,
        lineItemsJson: input.lineItemsJson || null,
        verifiedAt: asDate(input.verifiedAt), shippedAt: asDate(input.shippedAt),
        metadata: input.metadata || {}, updatedAt: new Date(),
      },
    }).returning();
    return result[0] ? mapDbOrder(result[0]) : null;
  } catch (error) {
    console.error('Failed to save order to PostgreSQL:', error);
    throw new Error('Database write failed while saving the order.', { cause: error });
  }
}

/** Insert a new invoice without overwriting an existing ID during concurrent requests. */
export async function createDbOrder(input: OrderInput) {
  const totalNum = input.totalNum ?? (Number(String(input.total || '').replace(/[^\d]/g, '')) || 0);
  const createdAt = asDate(input.createdAt) || new Date();
  const result = await db.insert(orders).values({
    id: input.id.toUpperCase(), userId: input.userId || null,
    product: input.product, productId: input.productId || null,
    item: input.item, itemId: input.itemId || null, target: input.target,
    status: input.status, total: input.total, totalNum,
    uniqueCode: input.uniqueCode ?? 0, payment: input.payment || null,
    paymentId: input.paymentId || null,
    paymentStatus: input.paymentStatus || 'pending',
    fulfillmentStatus: input.fulfillmentStatus || 'pending',
    whatsapp: input.whatsapp || null, email: input.email || null,
    lineItemsJson: input.lineItemsJson || null,
    verifiedAt: asDate(input.verifiedAt), shippedAt: asDate(input.shippedAt),
    createdAt, updatedAt: new Date(), metadata: input.metadata || {},
  }).onConflictDoNothing({ target: orders.id }).returning();
  return result[0] ? mapDbOrder(result[0]) : null;
}

export async function deleteDbOrder(id: string) {
  const deleted = await db.delete(orders).where(eq(orders.id, id.toUpperCase())).returning({ id: orders.id });
  return deleted.length > 0;
}

export async function clearAllDbOrders() {
  await db.delete(orders);
  return true;
}

export async function updateDbOrderStatus(id: string, status: string) {
  const result = await db.update(orders).set({ status, updatedAt: new Date() })
    .where(eq(orders.id, id.toUpperCase())).returning();
  return result[0] ? mapDbOrder(result[0]) : null;
}

/** Orders that belong to one member (by member id or WhatsApp number), newest first. */
export async function getDbOrdersForMember(memberId: string, whatsapp?: string, limit = 200) {
  const cleanPhone = String(whatsapp || '').replace(/[\s-]/g, '').toLowerCase();
  const byMember = eq(orders.userId, memberId);
  const condition = cleanPhone
    ? or(byMember, sql`lower(regexp_replace(coalesce(${orders.whatsapp}, ''), '[\\s-]', '', 'g')) = ${cleanPhone}`)
    : byMember;
  const rows = await db.select().from(orders).where(condition)
    .orderBy(desc(orders.createdAt)).limit(Math.max(1, Math.min(500, limit)));
  return rows.map(mapDbOrder);
}

export async function countDbOrders(): Promise<number> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(orders);
  return rows[0]?.n ?? 0;
}

/** Cheap change signature for the admin dashboard: avoids re-downloading the order list when nothing changed. */
export async function getOrdersPulse(): Promise<{ count: number; lastUpdated: string }> {
  const rows = await db.select({
    n: sql<number>`count(*)::int`,
    last: sql<string | null>`max(${orders.updatedAt})::text`,
  }).from(orders);
  return { count: rows[0]?.n ?? 0, lastUpdated: rows[0]?.last ?? '' };
}
