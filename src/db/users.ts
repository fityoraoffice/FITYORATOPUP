import { createHash } from 'node:crypto';
import { and, eq, gt, lt, or, sql } from 'drizzle-orm';
import { db } from './index.js';
import { authSessions, users } from './schema.js';

export interface DbUserInput {
  id: string; name: string; email: string; whatsapp: string; joinedAt?: string;
  points: number; passwordHash: string; isAuthor?: boolean;
}

export interface DbUser extends DbUserInput {
  joinedAt: string;
  isAuthor: boolean;
}

export function mapDbUser(row: typeof users.$inferSelect): DbUser {
  return {
    id: row.uid,
    name: row.name || row.displayName || '',
    email: row.email,
    whatsapp: row.whatsapp || row.phone || '',
    joinedAt: (() => {
      const value = row.joinedAt || row.createdAt || new Date();
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    })(),
    points: row.points ?? 0,
    isAuthor: false,
    passwordHash: row.passwordHash || '',
  };
}

export async function getAllDbUsers() {
  const rows = await db.select().from(users).where(eq(users.role, 'member'));
  return rows.map(mapDbUser);
}

export async function getDbUserById(uid: string) {
  const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  return rows[0] ? mapDbUser(rows[0]) : null;
}

export async function getDbUserByIdentifier(identifier: string) {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return null;
  const cleanPhone = clean.replace(/[\s-]/g, '');
  const rows = await db.select().from(users).where(and(
    eq(users.role, 'member'),
    or(
      sql`lower(${users.email}) = ${clean}`,
      sql`regexp_replace(coalesce(nullif(${users.whatsapp}, ''), ${users.phone}, ''), '[\\s-]', '', 'g') = ${cleanPhone}`,
    ),
  )).limit(1);
  return rows[0] ? mapDbUser(rows[0]) : null;
}

export async function upsertDbUser(user: DbUserInput) {
  if (user.isAuthor) throw new Error('Author account cannot be stored as a member.');
  const now = new Date();
  const joinedAt = user.joinedAt ? new Date(user.joinedAt) : now;
  const result = await db.insert(users).values({
    uid: user.id, email: user.email, name: user.name, displayName: user.name,
    whatsapp: user.whatsapp, phone: user.whatsapp, passwordHash: user.passwordHash,
    points: user.points, role: 'member', joinedAt: Number.isNaN(joinedAt.getTime()) ? now : joinedAt,
    createdAt: now, updatedAt: now,
  }).onConflictDoUpdate({
    target: users.uid,
    set: { email: user.email, name: user.name, displayName: user.name,
      whatsapp: user.whatsapp, phone: user.whatsapp, passwordHash: user.passwordHash,
      points: user.points, updatedAt: now },
  }).returning();
  return result[0] ? mapDbUser(result[0]) : null;
}

export async function updateDbUser(uid: string, patch: Partial<Pick<DbUserInput, 'name' | 'whatsapp' | 'points' | 'passwordHash'>>) {
  const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) { set.name = patch.name; set.displayName = patch.name; }
  if (patch.whatsapp !== undefined) { set.whatsapp = patch.whatsapp; set.phone = patch.whatsapp; }
  if (patch.points !== undefined) set.points = patch.points;
  if (patch.passwordHash !== undefined) set.passwordHash = patch.passwordHash;
  const result = await db.update(users).set(set).where(and(
    eq(users.uid, uid),
    eq(users.role, 'member'),
  )).returning();
  return result[0] ? mapDbUser(result[0]) : null;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function saveDbSession(token: string, kind: 'admin' | 'member', session: { userId?: string; email: string; name?: string; expiresAt: number }) {
  await db.insert(authSessions).values({
    tokenHash: hashToken(token), kind, userId: session.userId || null,
    email: session.email, name: session.name || null,
    expiresAt: new Date(session.expiresAt),
  }).onConflictDoUpdate({
    target: authSessions.tokenHash,
    set: { kind, userId: session.userId || null, email: session.email,
      name: session.name || null, expiresAt: new Date(session.expiresAt) },
  });
}

export async function getDbSession(token: string, kind: 'admin' | 'member') {
  const rows = await db.select().from(authSessions).where(and(
    eq(authSessions.tokenHash, hashToken(token)),
    eq(authSessions.kind, kind),
    gt(authSessions.expiresAt, new Date()),
  )).limit(1);
  const row = rows[0];
  if (!row) return null;
  return { userId: row.userId || undefined, email: row.email, name: row.name || undefined, expiresAt: row.expiresAt.getTime() };
}

/** Remove session rows past their expiry so auth_sessions does not grow forever. */
export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
}

export async function deleteDbSession(token: string) {
  await db.delete(authSessions).where(eq(authSessions.tokenHash, hashToken(token)));
}

export async function writeDbAuditLog(action: string, performedBy: string, targetId?: string, details?: Record<string, unknown>, ipAddress?: string) {
  const { auditLogs } = await import('./schema.js');
  await db.insert(auditLogs).values({ action, performedBy, targetId: targetId || null, details: details || null, ipAddress: ipAddress || null });
}

export async function countDbUsers(): Promise<number> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'member'));
  return rows[0]?.n ?? 0;
}
