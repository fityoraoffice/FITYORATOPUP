import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { INITIAL_PRODUCTS_DATA, PAYMENT_METHODS } from './src/data/catalog.js';
import {
  getAllDbOrders,
  getDbOrderById,
  createDbOrder,
  upsertDbOrder,
  deleteDbOrder,
  clearAllDbOrders,
  getDbOrdersForMember,
  countDbOrders,
  getOrdersPulse
} from './src/db/orders.js';
import {
  getAllDbUsers,
  getDbUserById,
  countDbUsers,
  getDbUserByIdentifier,
  purgeExpiredSessions,
  upsertDbUser,
  updateDbUser,
  saveDbSession,
  getDbSession,
  deleteDbSession,
} from './src/db/users.js';
import { checkDatabaseConnection } from './src/db/index.js';
import { verifyTarget, isTargetAcceptable } from './src/utils/targetVerification.js';
import { hitRateLimit } from './src/db/rateLimit.js';
import { createMemoryLimiter } from './src/utils/rateLimit.js';
import { OFFICIAL_AUTHOR_EMAIL, isKnownAuthorIdentifier } from './src/utils/authorIdentity.js';
import { normalizeUniqueCode, calculateExpectedTotal, totalMatches } from './src/utils/orderPricing.js';
import { savePushSubscription, removePushSubscription, listPushSubscriptions } from './src/db/push.js';
import { loadVapidConfig, sendEmptyPush, isAllowedPushEndpoint } from './src/utils/webPush.js';
import { createReview, hasReviewForOrder, listApprovedReviews, listAllReviews, setReviewStatus, deleteReview, cleanText } from './src/db/reviews.js';
import { getEffectiveCatalog, saveCustomCatalog, sanitizeCatalog } from './src/db/catalog.js';
import { getSiteSettings, saveSiteSettings, sanitizeSiteSettings } from './src/db/siteSettings.js';

const cliArgs = process.argv.slice(2);
const portFlagIdx = cliArgs.indexOf('--port');
const cliPort = portFlagIdx !== -1 && cliArgs[portFlagIdx + 1] ? Number(cliArgs[portFlagIdx + 1]) : null;
const hostFlagIdx = cliArgs.indexOf('--host');
const cliHost = hostFlagIdx !== -1 && cliArgs[hostFlagIdx + 1] && !cliArgs[hostFlagIdx + 1].startsWith('-') ? cliArgs[hostFlagIdx + 1] : null;

const PORT = Number(process.env.PORT || cliPort || 3000);
const HOST = process.env.HOST || cliHost || '0.0.0.0';
const ORDERS_DB_PATH = path.join(process.cwd(), 'orders-db.json');
const USERS_DB_PATH = path.join(process.cwd(), 'users-db.json');

const PRIMARY_AUTHOR_EMAIL = String(process.env.ADMIN_EMAIL || OFFICIAL_AUTHOR_EMAIL).trim().toLowerCase();
const AUTHOR_EMAILS = Array.from(new Set([
  OFFICIAL_AUTHOR_EMAIL,
  PRIMARY_AUTHOR_EMAIL,
  ...String(process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()),
].filter(Boolean)));

function isAuthorMatch(identifierRaw: unknown): boolean {
  return isKnownAuthorIdentifier(identifierRaw, AUTHOR_EMAILS);
}

function isAuthorPasswordMatch(passwordRaw: unknown): boolean {
  const entered = String(passwordRaw || '');
  const configured = String(process.env.ADMIN_PASSWORD || '');
  if (!entered || !configured) return false;
  const left = Buffer.from(entered);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
}

interface ServerOrderRecord {
  id: string;
  product: string;
  item: string;
  target: string;
  lineItems?: Array<{ productId: string; itemId: string; quantity: number; userId: string; zoneId?: string }>;
  status: string;
  total: string;
  uniqueCode?: number;
  payment?: string;
  whatsapp?: string;
  memberName?: string;
  memberId?: string;
  createdAt?: string;
  paymentStatus?: 'pending' | 'verified';
  fulfillmentStatus?: 'pending' | 'processing' | 'shipped';
  targetVerificationLevel?: 'confirmed' | 'format_only';
  verifiedAt?: string;
  shippedAt?: string;
  auditLog?: Array<{ action: string; at: string; by: string }>;
}

interface ServerUserRecord {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  joinedAt: string;
  points: number;
  isAuthor?: boolean;
  passwordHash: string;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, stored: string): { valid: boolean; needsUpgrade: boolean } {
  if (stored.startsWith('scrypt$')) {
    const [, salt, expectedHex] = stored.split('$');
    if (!salt || !expectedHex) return { valid: false, needsUpgrade: false };
    try {
      const expected = Buffer.from(expectedHex, 'hex');
      const actual = scryptSync(password, salt, expected.length);
      return {
        valid: expected.length === actual.length && timingSafeEqual(expected, actual),
        needsUpgrade: false
      };
    } catch {
      return { valid: false, needsUpgrade: false };
    }
  }

  // One-time migration for legacy accounts where the stored value was reversible base64.
  try {
    const decoded = Buffer.from(stored, 'base64').toString('utf8');
    const valid = decoded === password && decoded.length > 0;
    return { valid, needsUpgrade: valid };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}

function isReservedAdminUser(user: any): boolean {
  return Boolean(user?.isAuthor || isAuthorMatch(user?.email) || isAuthorMatch(user?.whatsapp));
}

function publicUser(user: ServerUserRecord) {
  const { passwordHash: _passwordHash, isAuthor: _isAuthor, ...safe } = user;
  return safe;
}

class HighPerformanceDbEngine {
  private ordersMap = new Map<string, ServerOrderRecord>();
  private ordersList: ServerOrderRecord[] = [];
  private usersMap = new Map<string, ServerUserRecord>();
  private usersByEmail = new Map<string, ServerUserRecord>();
  private usersByPhone = new Map<string, ServerUserRecord>();

  private ordersTimer: NodeJS.Timeout | null = null;
  private usersTimer: NodeJS.Timeout | null = null;

  public stats = {
    reads: 0,
    writes: 0,
    cacheHits: 0,
    ordersCount: 0,
    usersCount: 0,
    lastSyncOrders: new Date().toISOString(),
    lastSyncUsers: new Date().toISOString(),
    startTime: Date.now()
  };

  constructor() {
    this.init();
  }

  private init() {
    if (!process.env.VERCEL) {
      this.loadUsers();
      this.loadOrders();
    }
    this.stats.ordersCount = this.ordersMap.size;
    this.stats.usersCount = this.usersMap.size;
  }

  private loadUsers() {
    try {
      if (fs.existsSync(USERS_DB_PATH)) {
        const raw = fs.readFileSync(USERS_DB_PATH, 'utf-8').replace(/^\uFEFF/, '').trim();
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const u of parsed) {
              if (u && typeof u === 'object' && typeof u.email === 'string' && typeof u.passwordHash === 'string' && !isReservedAdminUser(u)) {
                const user = u as ServerUserRecord;
                this.usersMap.set(user.id, user);
                this.usersByEmail.set(user.email.toLowerCase(), user);
                this.usersByPhone.set(user.whatsapp.replace(/[\s-]/g, ''), user);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[DB ENGINE] Warning: Failed to parse users DB, initialized empty memory cache.', err);
    }
  }

  private loadOrders() {
    try {
      if (fs.existsSync(ORDERS_DB_PATH)) {
        const raw = fs.readFileSync(ORDERS_DB_PATH, 'utf-8').replace(/^\uFEFF/, '').trim();
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            let migrated = false;
            const orders = parsed.filter((o: any) => o && typeof o === 'object' && typeof o.id === 'string') as ServerOrderRecord[];
            for (const order of orders) {
              const log = Array.isArray(order.auditLog) ? order.auditLog : [];
              const paymentHasProof = Boolean(order.verifiedAt) && log.some((entry) => entry?.action === 'payment_manually_verified');
              const shipmentHasProof = Boolean(order.shippedAt) && log.some((entry) => entry?.action === 'fulfillment_manually_marked_shipped');
              if (!order.paymentStatus) { order.paymentStatus = 'pending'; migrated = true; }
              if (!order.fulfillmentStatus) { order.fulfillmentStatus = 'pending'; migrated = true; }
              if (order.paymentStatus === 'verified' && !paymentHasProof) {
                order.paymentStatus = 'pending';
                order.verifiedAt = undefined;
                order.auditLog = [...log, { action: 'legacy_payment_state_reset_no_admin_proof', at: new Date().toISOString(), by: 'system-migration' }].slice(-100);
                migrated = true;
              }
              if (order.fulfillmentStatus === 'shipped' && !shipmentHasProof) {
                order.fulfillmentStatus = 'pending';
                order.shippedAt = undefined;
                order.auditLog = [...(Array.isArray(order.auditLog) ? order.auditLog : log), { action: 'legacy_fulfillment_state_reset_no_admin_proof', at: new Date().toISOString(), by: 'system-migration' }].slice(-100);
                migrated = true;
              }
              if (/batal|cancel/i.test(String(order.status || ''))) {
                order.status = 'Dibatalkan';
              } else if (order.paymentStatus !== 'verified') {
                if (order.status !== 'Menunggu Pembayaran') { order.status = 'Menunggu Pembayaran'; migrated = true; }
              } else if (order.fulfillmentStatus !== 'shipped') {
                if (order.status !== 'Pembayaran Terverifikasi • Menunggu Pengiriman') { order.status = 'Pembayaran Terverifikasi • Menunggu Pengiriman'; migrated = true; }
              } else if (order.status !== 'Selesai • Diamond/Produk Sudah Dikirim') {
                order.status = 'Selesai • Diamond/Produk Sudah Dikirim'; migrated = true;
              }
              this.ordersMap.set(order.id.toUpperCase(), order);
              this.ordersList.push(order);
            }
            if (migrated) {
              this.flushOrdersSync();
            }
          }
        }
      }
    } catch (err) {
      console.error('[DB ENGINE] Warning: Failed to parse orders DB, initialized empty memory cache.', err);
    }
  }

  // O(1) in-memory order queries
  getOrder(id: string): ServerOrderRecord | undefined {
    this.stats.reads++;
    this.stats.cacheHits++;
    return this.ordersMap.get(id.toUpperCase());
  }

  getAllOrders(): ServerOrderRecord[] {
    this.stats.reads++;
    this.stats.cacheHits++;
    return this.ordersList;
  }

  getOrdersForUser(memberId?: string, identifier?: string): ServerOrderRecord[] {
    this.stats.reads++;
    this.stats.cacheHits++;
    const cleanPh = identifier ? identifier.replace(/[\s-]/g, '').toLowerCase() : '';
    const cleanEmail = identifier ? identifier.trim().toLowerCase() : '';
    return this.ordersList.filter((o) => {
      if (memberId && o.memberId === memberId) return true;
      if (cleanPh && o.whatsapp && o.whatsapp.replace(/[\s-]/g, '').toLowerCase() === cleanPh) return true;
      if (cleanEmail && o.memberName && o.memberName.toLowerCase().includes(cleanEmail)) return true;
      return false;
    });
  }

  addOrder(order: ServerOrderRecord): boolean {
    this.stats.writes++;
    this.ordersMap.set(order.id.toUpperCase(), order);
    this.ordersList.unshift(order);
    if (this.ordersList.length > 5000) {
      const removed = this.ordersList.pop();
      if (removed) this.ordersMap.delete(removed.id.toUpperCase());
    }
    this.stats.ordersCount = this.ordersMap.size;
    this.scheduleOrdersFlush();
    return true;
  }

  updateOrder(id: string, updater: (order: ServerOrderRecord) => void): ServerOrderRecord | null {
    const existing = this.ordersMap.get(id.toUpperCase());
    if (!existing) return null;
    this.stats.writes++;
    updater(existing);
    this.scheduleOrdersFlush();
    return existing;
  }

  // O(1) in-memory user queries
  getUserById(id: string): ServerUserRecord | undefined {
    this.stats.reads++;
    this.stats.cacheHits++;
    return this.usersMap.get(id);
  }

  getUserByIdentifier(identifier: string): ServerUserRecord | undefined {
    this.stats.reads++;
    this.stats.cacheHits++;
    const cleanId = identifier.trim().toLowerCase();
    const cleanPh = cleanId.replace(/[\s-]/g, '');
    return this.usersByEmail.get(cleanId) || this.usersByPhone.get(cleanPh);
  }

  getAllUsers(): ServerUserRecord[] {
    this.stats.reads++;
    this.stats.cacheHits++;
    return Array.from(this.usersMap.values());
  }

  addUser(user: ServerUserRecord): boolean {
    this.stats.writes++;
    this.usersMap.set(user.id, user);
    this.usersByEmail.set(user.email.toLowerCase(), user);
    this.usersByPhone.set(user.whatsapp.replace(/[\s-]/g, ''), user);
    this.stats.usersCount = this.usersMap.size;
    this.scheduleUsersFlush();
    return true;
  }

  updateUser(id: string, updater: (user: ServerUserRecord) => void): ServerUserRecord | null {
    const existing = this.usersMap.get(id);
    if (!existing) return null;
    this.stats.writes++;
    const oldEmail = existing.email.toLowerCase();
    const oldPhone = existing.whatsapp.replace(/[\s-]/g, '');
    updater(existing);
    if (existing.email.toLowerCase() !== oldEmail) {
      this.usersByEmail.delete(oldEmail);
      this.usersByEmail.set(existing.email.toLowerCase(), existing);
    }
    if (existing.whatsapp.replace(/[\s-]/g, '') !== oldPhone) {
      this.usersByPhone.delete(oldPhone);
      this.usersByPhone.set(existing.whatsapp.replace(/[\s-]/g, ''), existing);
    }
    this.scheduleUsersFlush();
    return existing;
  }

  // Asynchronous Debounced Atomic Disk Persistence
  private scheduleOrdersFlush() {
    if (this.ordersTimer) return;
    this.ordersTimer = setTimeout(() => {
      this.ordersTimer = null;
      this.flushOrdersSync();
    }, 40);
  }

  private scheduleUsersFlush() {
    if (this.usersTimer) return;
    this.usersTimer = setTimeout(() => {
      this.usersTimer = null;
      this.flushUsersSync();
    }, 40);
  }

  public flushOrdersSync(): boolean {
    if (process.env.VERCEL) return true;
    try {
      const tempPath = `${ORDERS_DB_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.ordersList.slice(0, 5000), null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tempPath, ORDERS_DB_PATH);
      this.stats.lastSyncOrders = new Date().toISOString();
      return true;
    } catch (err) {
      console.error('[DB ENGINE] Error syncing orders to disk:', err);
      return false;
    }
  }

  public flushUsersSync(): boolean {
    if (process.env.VERCEL) return true;
    try {
      const safeUsers = Array.from(this.usersMap.values()).filter((u) => !isReservedAdminUser(u)).slice(0, 2000);
      const tempPath = `${USERS_DB_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(safeUsers, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tempPath, USERS_DB_PATH);
      this.stats.lastSyncUsers = new Date().toISOString();
      return true;
    } catch (err) {
      console.error('[DB ENGINE] Error syncing users to disk:', err);
      return false;
    }
  }

  public flushAll() {
    this.flushOrdersSync();
    this.flushUsersSync();
  }

  /** Cache one record without discarding the rest (request-scoped lookups). */
  public putUser(user: ServerUserRecord): void {
    if (!user || !user.id || isReservedAdminUser(user)) return;
    this.usersMap.set(user.id, user);
    if (user.email) this.usersByEmail.set(user.email.toLowerCase(), user);
    this.usersByPhone.set(String(user.whatsapp || '').replace(/[\s-]/g, ''), user);
  }

  public putOrder(order: ServerOrderRecord): void {
    if (!order || !order.id) return;
    this.ordersMap.set(order.id.toUpperCase(), order);
  }

  public setUsers(users: ServerUserRecord[]): void {
    this.usersMap.clear();
    this.usersByEmail.clear();
    this.usersByPhone.clear();
    for (const user of users) {
      if (!user || !user.id || !user.email || !user.passwordHash || isReservedAdminUser(user)) continue;
      this.usersMap.set(user.id, user);
      this.usersByEmail.set(user.email.toLowerCase(), user);
      this.usersByPhone.set(String(user.whatsapp || '').replace(/[\s-]/g, ''), user);
    }
    this.stats.usersCount = this.usersMap.size;
  }

  public setOrders(orders: ServerOrderRecord[]): void {
    this.ordersMap.clear();
    this.ordersList = [...orders];
    for (const o of orders) {
      if (o && o.id) {
        this.ordersMap.set(o.id.toUpperCase(), o);
      }
    }
    this.stats.ordersCount = this.ordersMap.size;
  }
}

const dbEngine = new HighPerformanceDbEngine();





// Optional Supabase Realtime Broadcast: a PII-free "something changed" ping so the admin dashboard
// refreshes instantly. Uses only the public anon key; the payload never contains order or member data.
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || '').trim();
const REALTIME_CHANNEL = String(process.env.SUPABASE_REALTIME_CHANNEL || 'fityora-orders-pulse').trim();
const REALTIME_ENABLED = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

/** Kirim ketukan push ke semua perangkat Author. Tidak pernah menggagalkan pembuatan order. */
async function notifyAdminDevicesOfNewOrder(): Promise<{ sent: number; failed: number; total: number }> {
  const cfg = loadVapidConfig();
  if (!cfg) return { sent: 0, failed: 0, total: 0 };
  const subs = await listPushSubscriptions();
  let sent = 0;
  let failed = 0;
  await Promise.all(subs.map(async (sub) => {
    const result = await sendEmptyPush(sub, cfg);
    if (result === 'sent') sent += 1;
    else {
      failed += 1;
      if (result === 'gone') await removePushSubscription(sub.endpoint).catch(() => undefined);
    }
  }));
  return { sent, failed, total: subs.length };
}

async function notifyOrderChanged(): Promise<void> {
  if (!REALTIME_ENABLED) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: REALTIME_CHANNEL, event: 'order-changed', payload: { t: Date.now() }, private: false }] }),
      signal: controller.signal,
    });
  } catch {
    // Best effort only: the dashboard still falls back to polling.
  } finally {
    clearTimeout(timer);
  }
}

/** Persist exactly one changed order (previously every order was re-upserted on each change). */
async function persistOrder(order: ServerOrderRecord): Promise<boolean> {
  try {
    await upsertDbOrder({
      id: order.id, userId: order.memberId || null, product: order.product,
      productId: order.lineItems?.[0]?.productId || null, item: order.item,
      itemId: order.lineItems?.[0]?.itemId || null, target: order.target,
      status: order.status, total: order.total,
      totalNum: Number(String(order.total || '').replace(/[^\d]/g, '')) || 0,
      uniqueCode: order.uniqueCode || 0, payment: order.payment || null,
      paymentStatus: order.paymentStatus || 'pending',
      fulfillmentStatus: order.fulfillmentStatus || 'pending',
      whatsapp: order.whatsapp || null, lineItemsJson: JSON.stringify(order.lineItems || []),
      verifiedAt: order.verifiedAt || null, shippedAt: order.shippedAt || null,
      createdAt: order.createdAt || null, metadata: order as unknown as Record<string, unknown>,
    });
    dbEngine.putOrder(order);
    await notifyOrderChanged();
    return true;
  } catch (error) {
    console.error('[PostgreSQL] Failed to persist order change:', error);
    return false;
  }
}

function safePublicOrder(order: ServerOrderRecord) {
  return {
    id: order.id,
    product: order.product,
    item: order.item,
    target: order.target,
    status: order.status,
    total: order.total,
    uniqueCode: order.uniqueCode,
    payment: order.payment,
    createdAt: order.createdAt,
    paymentStatus: order.paymentStatus || 'pending',
    fulfillmentStatus: order.fulfillmentStatus || 'pending',
    targetVerificationLevel: order.targetVerificationLevel,
    verifiedAt: order.verifiedAt,
    shippedAt: order.shippedAt
  };
}

async function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  // Sessions are persisted to PostgreSQL; only SHA-256 token hashes are stored there.
  const adminSessions = new Map<string, { expiresAt: number; email: string }>();
  const memberSessions = new Map<string, { userId: string; expiresAt: number; email: string; name: string }>();

  const saveAdminSessionsToDisk = async (map: Map<string, { expiresAt: number; email: string }>) => {
    await Promise.all(Array.from(map.entries()).map(([id, session]) =>
      saveDbSession(id, 'admin', { email: session.email, expiresAt: session.expiresAt })
    ));
  };

  const saveMemberSessionsToDisk = async (map: Map<string, { userId: string; expiresAt: number; email: string; name: string }>) => {
    await Promise.all(Array.from(map.entries()).map(([id, session]) =>
      saveDbSession(id, 'member', { userId: session.userId, email: session.email, name: session.name, expiresAt: session.expiresAt })
    ));
  };

  // Pembatas laju: terpusat di Postgres agar berlaku lintas instance Vercel; cadangan memori bila DB gagal.
  const memoryLimiter = createMemoryLimiter();
  const allowRateLimitedRequest = async (key: string, max: number, windowMs: number): Promise<boolean> => {
    try {
      return (await hitRateLimit(key, windowMs)) <= max;
    } catch (error) {
      console.error('[RateLimit] DB limiter unavailable, using memory fallback:', error);
      return memoryLimiter(key, max, windowMs);
    }
  };

  const getCookie = (req: express.Request, name: string): string => {
    const header = String(req.headers.cookie || '');
    const entry = header.split(';').map((x) => x.trim()).find((x) => x.startsWith(`${name}=`));
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
  };

  const extractAdminTokenFromRequest = (req: express.Request): string => {
    let id = getCookie(req, 'cahyo_admin_session');
    if (!id && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      id = req.headers.authorization.slice(7).trim();
    }
    if (!id && req.headers['x-admin-token']) {
      id = String(req.headers['x-admin-token']).trim();
    }
    // Token via URL query string sengaja tidak diterima (bocor ke log, riwayat browser, dan referrer).
    return id;
  };

  const getAdminSession = (req: express.Request) => {
    const id = extractAdminTokenFromRequest(req);
    const session = id ? adminSessions.get(id) : undefined;
    if (!session || session.expiresAt <= Date.now()) {
      if (id && adminSessions.has(id)) {
        adminSessions.delete(id);
        void deleteDbSession(id);
      }
      return null;
    }
    // Rolling session extension (keeps session alive for 30 days of active usage)
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (session.expiresAt - Date.now() < THIRTY_DAYS / 2) {
      session.expiresAt = Date.now() + THIRTY_DAYS;
      void saveDbSession(id, 'admin', { email: session.email, expiresAt: session.expiresAt });
    }
    return { ...session, sessionId: id };
  };

  const getMemberSession = (req: express.Request) => {
    let id = getCookie(req, 'cahyo_member_session');
    if (!id && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      id = req.headers.authorization.slice(7).trim();
    }
    if (!id && req.headers['x-member-token']) {
      id = String(req.headers['x-member-token']).trim();
    }
    if (!id) return null;
    const session = memberSessions.get(id);
    if (!session || session.expiresAt <= Date.now()) {
      if (id && memberSessions.has(id)) {
        memberSessions.delete(id);
        void deleteDbSession(id);
      }
      return null;
    }
    const user = dbEngine.getUserById(session.userId);
    if (!user) return null;
    return { session, user, sessionId: id };
  };

  // Each API call only validates the caller's session (indexed lookups). Orders and members are
  // read per route, scoped to what that route needs, instead of loading whole tables every time.
  app.use(['/api/admin', '/api/orders', '/api/users', '/api/export'], async (req, res, next) => {
    try {
      const adminToken = extractAdminTokenFromRequest(req);
      let memberToken = getCookie(req, 'cahyo_member_session');
      if (!memberToken && req.headers.authorization?.startsWith('Bearer ')) memberToken = req.headers.authorization.slice(7).trim();
      if (!memberToken && req.headers['x-member-token']) memberToken = String(req.headers['x-member-token']).trim();

      const [adminSession, memberSession] = await Promise.all([
        adminToken ? getDbSession(adminToken, 'admin') : Promise.resolve(null),
        memberToken ? getDbSession(memberToken, 'member') : Promise.resolve(null),
      ]);

      if (adminToken) {
        if (adminSession) adminSessions.set(adminToken, { email: adminSession.email, expiresAt: adminSession.expiresAt });
        else adminSessions.delete(adminToken);
      }
      if (memberToken) {
        if (memberSession?.userId && memberSession.name) {
          memberSessions.set(memberToken, {
            userId: memberSession.userId, email: memberSession.email, name: memberSession.name, expiresAt: memberSession.expiresAt,
          });
          const member = await getDbUserById(memberSession.userId);
          if (member) dbEngine.putUser(member as ServerUserRecord);
        } else {
          memberSessions.delete(memberToken);
        }
      }
      next();
    } catch (error) {
      console.error('[PostgreSQL] API request blocked because database load failed:', error);
      res.status(503).json({ error: 'Database CahyoStore sedang tidak dapat diakses. Pesanan dan perubahan akun tidak diproses.' });
    }
  });

  const requireAdminSession = (req: express.Request, res: express.Response): boolean => {
    if (!getAdminSession(req)) {
      res.status(401).json({ error: 'Sesi admin tidak valid atau kedaluwarsa. Silakan login kembali.' });
      return false;
    }
    return true;
  };

  const addAuditEntry = (order: ServerOrderRecord, action: string, email: string) => {
    const log = Array.isArray(order.auditLog) ? order.auditLog : [];
    order.auditLog = [...log, { action, at: new Date().toISOString(), by: email }].slice(-100);
  };

  app.post('/api/admin/login', async (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    const now = Date.now();
    // Batas dicek SEBELUM sandi dicocokkan, jadi tebakan sandi benar-benar terhenti saat terkunci.
    const withinIpLimit = await allowRateLimitedRequest(`admin-login:${ip}`, 10, 10 * 60 * 1000);
    if (!withinIpLimit) {
      res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' });
      return;
    }
    const identifier = String(req.body?.identifier || req.body?.email || req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    const authorIdMatch = isAuthorMatch(identifier);
    const authorPassMatch = isAuthorPasswordMatch(password);

    if (authorIdMatch && authorPassMatch) {
      const sessionEmail = identifier.includes('@') ? identifier : PRIMARY_AUTHOR_EMAIL;
      const sessionId = randomBytes(32).toString('hex');
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      const expiresAt = now + THIRTY_DAYS;
      adminSessions.set(sessionId, { expiresAt, email: sessionEmail });
      try { await saveAdminSessionsToDisk(adminSessions); }
      catch (error) { adminSessions.delete(sessionId); console.error('[Auth] Failed to save admin session:', error); res.status(503).json({ error: 'Sesi admin gagal disimpan ke database.' }); return; }

      const secure = process.env.NODE_ENV === 'production' || req.secure ? '; Secure' : '';
      // 30 days max age
      res.setHeader(
        'Set-Cookie',
        `cahyo_admin_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`
      );
      res.json({
        ok: true,
        token: sessionId,
        user: {
          id: 'AUTHOR-01',
          name: 'Author CahyoStore',
          email: sessionEmail,
          whatsapp: '08139525985',
          joinedAt: new Date().toISOString(),
          points: 99999,
          isAuthor: true
        }
      });
      return;
    }

    res.status(401).json({ error: 'Email/Username/WhatsApp Author atau kata sandi tidak cocok. Gunakan kredensial resmi Author CahyoStore.' });
  });

  app.get('/api/admin/db-stats', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const memory = process.memoryUsage();
    let ordersCount = 0;
    let usersCount = 0;
    try { [ordersCount, usersCount] = await Promise.all([countDbOrders(), countDbUsers()]); }
    catch (error) { console.error('[PostgreSQL] db-stats count failed:', error); }
    res.json({
      ok: true,
      engine: 'Supabase PostgreSQL (persistent source of truth) + scoped queries',
      stats: {
        ...dbEngine.stats,
        ordersCount,
        usersCount,
        activeAdminSessions: adminSessions.size,
        activeMemberSessions: memberSessions.size,
        heapUsedMb: (memory.heapUsed / 1024 / 1024).toFixed(2),
        rssMb: (memory.rss / 1024 / 1024).toFixed(2),
        uptimeSeconds: Math.round(process.uptime()),
        responseLatencyEst: '< 1ms'
      }
    });
  });

  // Tiny change signature (count + last update) polled by the dashboard instead of the full order list.
  app.get('/api/admin/orders/pulse', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, ...(await getOrdersPulse()) });
    } catch (error) {
      console.error('[PostgreSQL] Orders pulse failed:', error);
      res.status(503).json({ error: 'Database sedang tidak dapat diakses.' });
    }
  });

  // Public Supabase values only (URL + anon key + channel). Never the database URL or service key.
  app.get('/api/admin/realtime-config', (req, res) => {
    if (!requireAdminSession(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    if (!REALTIME_ENABLED) { res.json({ enabled: false }); return; }
    res.json({ enabled: true, url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, channel: REALTIME_CHANNEL });
  });

  // Pengaturan tampilan publik (tema, animasi, wallpaper, musik latar). Dibaca semua pengunjung,
  // hanya bisa diubah Author. Tidak berisi data pribadi apa pun.
  app.get('/api/site-settings', async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=60');
      res.json({ ok: true, ...(await getSiteSettings()) });
    } catch (error) {
      console.error('[PostgreSQL] Site settings read failed:', error);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: false, settings: null, updatedAt: null });
    }
  });

  app.put('/api/admin/site-settings', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const settings = sanitizeSiteSettings(req.body);
    if (!settings) { res.status(400).json({ error: 'Format pengaturan tidak valid.' }); return; }
    try {
      const updatedAt = await saveSiteSettings(settings);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, settings, updatedAt });
    } catch (error) {
      console.error('[PostgreSQL] Site settings save failed:', error);
      res.status(503).json({ error: 'Pengaturan gagal disimpan ke database.' });
    }
  });

  // Katalog & harga: dibaca semua pengunjung, hanya Author yang bisa mengubah. Server juga memakainya
  // untuk memvalidasi total order, jadi tampilan buyer dan tagihan selalu sama.
  app.get('/api/catalog', async (_req, res) => {
    try {
      const catalog = await getEffectiveCatalog();
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=30');
      res.json({ ok: true, ...catalog });
    } catch (error) {
      console.error('[PostgreSQL] Catalog read failed:', error);
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({ ok: false, error: 'Katalog sedang tidak dapat dimuat.' });
    }
  });

  app.put('/api/admin/catalog', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const products = sanitizeCatalog(req.body?.products);
    if (!products) { res.status(400).json({ error: 'Format katalog tidak valid (produk/harga ditolak).' }); return; }
    try {
      const updatedAt = await saveCustomCatalog(products);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, updatedAt, count: products.length });
    } catch (error) {
      console.error('[PostgreSQL] Catalog save failed:', error);
      res.status(503).json({ error: 'Katalog gagal disimpan ke database.' });
    }
  });

  // ---- Notifikasi push ke HP Author (VAPID; pesan tanpa data pesanan) ----
  app.get('/api/admin/push/config', (req, res) => {
    if (!requireAdminSession(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    const cfg = loadVapidConfig();
    res.json({ enabled: Boolean(cfg), publicKey: cfg?.publicKey || '' });
  });

  app.post('/api/admin/push/subscribe', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const endpoint = String(req.body?.endpoint || '').trim();
    const p256dh = String(req.body?.keys?.p256dh || '').trim().slice(0, 200);
    const auth = String(req.body?.keys?.auth || '').trim().slice(0, 100);
    if (!isAllowedPushEndpoint(endpoint) || endpoint.length > 1000 || !p256dh || !auth) {
      res.status(400).json({ error: 'Data langganan notifikasi tidak valid.' });
      return;
    }
    try { await savePushSubscription({ endpoint, p256dh, auth }); res.json({ ok: true }); }
    catch (error) { console.error('[Push] Save subscription failed:', error); res.status(503).json({ error: 'Langganan belum tersimpan.' }); }
  });

  app.post('/api/admin/push/unsubscribe', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const endpoint = String(req.body?.endpoint || '').trim();
    if (!endpoint) { res.status(400).json({ error: 'Endpoint kosong.' }); return; }
    try { await removePushSubscription(endpoint); res.json({ ok: true }); }
    catch { res.status(503).json({ error: 'Gagal menghapus langganan.' }); }
  });

  app.post('/api/admin/push/test', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try { res.json({ ok: true, ...(await notifyAdminDevicesOfNewOrder()) }); }
    catch (error) { console.error('[Push] Test failed:', error); res.status(503).json({ error: 'Tes notifikasi gagal.' }); }
  });

  // Status konfigurasi (tanpa nilai rahasia) agar Author bisa memeriksa Environment Variables di Vercel.
  app.get('/api/admin/health', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    let database = false;
    try { await checkDatabaseConnection(); database = true; } catch { /* dilaporkan false */ }
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: database,
      database,
      vercel: Boolean(process.env.VERCEL),
      region: process.env.VERCEL_REGION || null,
      env: {
        DATABASE_URL: Boolean(process.env.DATABASE_URL),
        ADMIN_EMAIL: Boolean(process.env.ADMIN_EMAIL),
        ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
        GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
        SUPABASE_REALTIME: REALTIME_ENABLED,
        VAPID_PUSH: Boolean(loadVapidConfig()),
        DATABASE_SSL_CA: Boolean(process.env.DATABASE_SSL_CA),
      },
    });
  });

  app.get('/api/admin/session', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const session = getAdminSession(req);
    if (!session) {
      res.status(401).json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      email: session.email,
      expiresAt: new Date(session.expiresAt).toISOString(),
      token: session.sessionId,
      user: {
        id: 'AUTHOR-01',
        name: 'Author CahyoStore',
        email: session.email,
        whatsapp: '08139525985',
        joinedAt: '1 Jan 2025',
        points: 99999,
        isAuthor: true
      }
    });
  });

  app.post('/api/admin/logout', async (req, res) => {
    const sessionId = extractAdminTokenFromRequest(req) || String(req.body?.token || '').trim();
    if (sessionId) {
      adminSessions.delete(sessionId);
      await deleteDbSession(sessionId);
    }
    const secure = process.env.NODE_ENV === 'production' || req.secure ? '; Secure' : '';
    res.setHeader('Set-Cookie', `cahyo_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    res.json({ ok: true, message: 'Berhasil keluar dari sesi Author.' });
  });

  // Endpoint 00: 24/7 Keep-Alive Heartbeat for Privatedactyl / Pterodactyl & UptimeRobot
  app.get(['/api/ping', '/healthz'], async (_req, res) => {
    try {
      await checkDatabaseConnection();
      res.json({
        ok: true,
        database: 'connected',
        service: 'CahyoStore API',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Health] PostgreSQL connection check failed:', error);
      res.status(503).json({
        ok: false,
        database: 'disconnected',
        service: 'CahyoStore API',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Privileged operations require the server-managed admin session.

  // Automated Live Website ZIP Generator & Exporter
  const ZIP_OUTPUT_PATH = path.join(process.cwd(), 'public', 'CahyoStore-Full-Website-Files.zip');
  const ZIP_DOWNLOADS_PATH = path.join(process.cwd(), 'public', 'downloads', 'CahyoStore-Full-Website-Files.zip');
  let lastZipGeneratedAt: string = '';
  let lastZipSizeBytes: number = 0;

  const buildAndSaveLiveWebsiteZip = async (): Promise<Buffer> => {
    const zip = new JSZip();
    const rootDir = process.cwd();
    const excludedDirs = new Set([
      'node_modules',
      '.git',
      'dist',
      '.next',
      '.cache',
      '.turbo'
    ]);
    const excludedFiles = new Set([
      'bun.lock',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '.DS_Store',
      'users-db.json',
      'orders-db.json',
      'admin-sessions.json',
      'member-sessions.json',
      'WhatsAppBotFixerModal.tsx',
      'waBotDedicatedUploader.ts',
      'waBotNoKeyDownloader.ts',
      'waBotScriptAnalyzer.ts',
      'waBotVersionAndPerfEngine.ts',
      'CahyoStore-Full-Website-Files.zip'
    ]);

    const addDirToZip = (currentPath: string, relativePrefix = '') => {
      if (!fs.existsSync(currentPath)) return;
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const name = entry.name;
        if (entry.isDirectory()) {
          if (excludedDirs.has(name) || name.startsWith('.git') || name.startsWith('.vercel')) continue;
          addDirToZip(
            path.join(currentPath, name),
            relativePrefix ? `${relativePrefix}/${name}` : name
          );
        } else if (entry.isFile()) {
          const lowerName = name.toLowerCase();
          const looksLikeSecret =
            (lowerName.startsWith('.env') && lowerName !== '.env.example') ||
            lowerName === '.npmrc' ||
            /\.(pem|key|p12|pfx|crt|cer)$/i.test(name) ||
            /(^|[-_.])(secret|credentials?)([-_.]|$)/i.test(name);
          if (excludedFiles.has(name) || name.endsWith('.zip') || looksLikeSecret || name.endsWith('.tmp')) continue;
          const fullPath = path.join(currentPath, name);
          const zipEntryPath = relativePrefix ? `${relativePrefix}/${name}` : name;
          try {
            const fileBuffer = fs.readFileSync(fullPath);
            zip.file(zipEntryPath, fileBuffer);
          } catch {
            // ignore unreadable file
          }
        }
      }
    };

    addDirToZip(rootDir);

    // Inject automated build & version metadata into the root of the ZIP
    const buildTimestamp = new Date().toISOString();
    const versionMeta = {
      appName: 'CahyoStore (FitYora Store)',
      version: 'v1.2.2026.11',
      author: 'Author CahyoStore (fityorastoreoffice@gmail.com)',
      supportWhatsapp: '08139525985',
      updatedAt: buildTimestamp,
      autoUpdated: true,
      description: 'Source CahyoStore dengan Express Function di Vercel dan Supabase PostgreSQL untuk penyimpanan utama.',
      instructions: [
        '1. Supabase SQL Editor: instalasi baru jalankan supabase/schema.sql; database lama jalankan migrasi berurutan sampai 20261110_tahap6_secure_and_tables.sql.',
        '2. Atur DATABASE_URL, ADMIN_EMAIL, dan ADMIN_PASSWORD sebagai Environment Variables Secret di Vercel.',
        '3. Push source ke repository yang terhubung ke Vercel dan deploy ulang (opsional: VAPID_* untuk notifikasi push, lihat docs/README-VERCEL-DEPLOY.md).',
        '4. Uji /api/ping, login, registrasi member, invoice, dan status pesanan.'
      ]
    };

    zip.file('VERSION-METADATA.json', JSON.stringify(versionMeta, null, 2));
    zip.file(
      'README-CAHYOSTORE-RESMI.txt',
      `============================================================\n` +
      `CAHYO STORE (FITYORA STORE) - PAKET KODE SUMBER LENGKAP RESMI\n` +
      `============================================================\n\n` +
      `Tanggal Update Otomatis: ${buildTimestamp}\n` +
      `Author: CahyoStore Developer\n` +
      `Email: fityorastoreoffice@gmail.com\n` +
      `WhatsApp: 08139525985\n\n` +
      `STATUS SISTEM:\n` +
      `- Kode sumber 100% tersinkronisasi otomatis dengan pembaruan dan perbaikan terkini.\n` +
      `- QRIS statis GoPay Merchant; konfirmasi pembayaran dilakukan manual oleh Author.\n` +
      `- Manajemen sesi tersimpan di Supabase PostgreSQL (token disimpan dalam bentuk hash).\n` +
      `- Navigasi mobile responsif dan teroptimasi rapi.\n\n` +
      `CARA MENJALANKAN:\n` +
      `1. Jalankan supabase/migrations/20261107_backend_storage.sql satu kali.\n` +
      `2. Atur DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD di Vercel sebagai Secret.\n` +
      `3. Push source dan deploy ulang melalui Vercel.\n` +
      `4. Uji /api/ping dan semua alur member/order sebelum production.\n`
    );

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const ZIP_VERCEL_PATH = path.join(process.cwd(), 'public', 'CahyoStore-Vercel-Deploy.zip');
    const ZIP_VERCEL_DOWNLOADS_PATH = path.join(process.cwd(), 'public', 'downloads', 'CahyoStore-Vercel-Deploy.zip');
    const ZIP_SUPABASE_PATH = path.join(process.cwd(), 'public', 'CahyoStore-Supabase-Vercel.zip');
    const ZIP_SUPABASE_DOWNLOADS_PATH = path.join(process.cwd(), 'public', 'downloads', 'CahyoStore-Supabase-Vercel.zip');

    try {
      fs.writeFileSync(ZIP_OUTPUT_PATH, zipBuffer);
      fs.writeFileSync(ZIP_VERCEL_PATH, zipBuffer);
      fs.writeFileSync(ZIP_SUPABASE_PATH, zipBuffer);
      const downloadsDir = path.dirname(ZIP_DOWNLOADS_PATH);
      if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
      fs.writeFileSync(ZIP_DOWNLOADS_PATH, zipBuffer);
      fs.writeFileSync(ZIP_VERCEL_DOWNLOADS_PATH, zipBuffer);
      fs.writeFileSync(ZIP_SUPABASE_DOWNLOADS_PATH, zipBuffer);
      lastZipGeneratedAt = buildTimestamp;
      lastZipSizeBytes = zipBuffer.length;
      console.log(`[AutoZip] File ZIP website, Vercel & Supabase otomatis diperbarui: ${(zipBuffer.length / 1024).toFixed(1)} KB pada ${buildTimestamp}`);
    } catch (e) {
      console.warn('[AutoZip] Gagal menyimpan file zip ke disk:', e);
    }

    return zipBuffer;
  };

  // Endpoint: Get Live Info of Auto-Updated Website ZIP File
  app.get('/api/export/website-zip/info', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const size = lastZipSizeBytes || (fs.existsSync(ZIP_OUTPUT_PATH) ? fs.statSync(ZIP_OUTPUT_PATH).size : 820000);
    res.json({
      ok: true,
      lastUpdated: lastZipGeneratedAt || new Date().toISOString(),
      sizeBytes: size,
      sizeFormatted: `${(size / 1024).toFixed(1)} KB`,
      autoUpdateActive: true,
      vercelReady: true,
      supabaseReady: true
    });
  });

  // Endpoint: Export All Website Files as ZIP Archive for Author (Always Freshly Auto-Updated)
  app.all('/api/export/website-zip', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      // Rebuild and update live ZIP file so it is always 100% freshly updated with latest changes
      const zipBuffer = await buildAndSaveLiveWebsiteZip();

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="CahyoStore-Full-Website-Files.zip"'
      );
      res.send(zipBuffer);
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Gagal membuat paket ZIP semua file website.'
      });
    }
  });

  // Endpoint: Export Specialized Vercel Deployment Package (Configured with vercel.json & Instructions)
  app.all('/api/export/vercel-zip', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const zipBuffer = await buildAndSaveLiveWebsiteZip();

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="CahyoStore-Vercel-Deploy.zip"'
      );
      res.send(zipBuffer);
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Gagal membuat paket ZIP khusus deploy Vercel.'
      });
    }
  });

  // Endpoint: Export Specialized Supabase + Vercel SQL Deployment Package
  app.all('/api/export/supabase-zip', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const zipBuffer = await buildAndSaveLiveWebsiteZip();

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="CahyoStore-Supabase-Vercel.zip"'
      );
      res.send(zipBuffer);
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Gagal membuat paket ZIP khusus Supabase + Vercel SQL.'
      });
    }
  });

  //

  // Central order API: customers may create and track an order; only an authenticated
  // admin can view the full queue, verify payment, alter statuses, or delete an order.
  app.get('/api/orders', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ orders: await getAllDbOrders() });
    } catch (error) {
      console.error('[PostgreSQL] Listing orders failed:', error);
      res.status(503).json({ error: 'Daftar pesanan gagal dimuat dari database.' });
    }
  });

  app.get('/api/orders/:id', async (req, res) => {
    const id = String(req.params.id || '').trim().toUpperCase();
    if (!/^CS-[A-Z0-9-]{5,40}$/.test(id)) {
      res.status(400).json({ error: 'Format ID pesanan tidak valid.' });
      return;
    }
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    if (!(await allowRateLimitedRequest(`track-order:${ip}`, 600, 10 * 60 * 1000))) {
      res.status(429).json({ error: 'Terlalu banyak pemeriksaan pesanan. Coba lagi beberapa menit.' });
      return;
    }
    let found: ServerOrderRecord | null = null;
    try { found = await getDbOrderById(id) as ServerOrderRecord | null; }
    catch { res.status(503).json({ error: 'Database sedang tidak dapat diakses. Coba lagi sebentar.' }); return; }
    if (!found) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ order: safePublicOrder(found) });
  });

  // ---- Ulasan pelanggan (hanya dari pesanan yang sudah terkirim; tampil setelah disetujui Author) ----
  app.get('/api/reviews', async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=120');
      res.json({ ok: true, ...(await listApprovedReviews()) });
    } catch (error) {
      console.error('[PostgreSQL] Reviews read failed:', error);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: false, reviews: [], count: 0, average: 0 });
    }
  });

  app.post('/api/orders/:id/review', async (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    if (!(await allowRateLimitedRequest(`review:${ip}`, 10, 10 * 60 * 1000))) {
      res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });
      return;
    }
    const id = String(req.params.id || '').trim().toUpperCase();
    if (!/^CS-[A-Z0-9-]{5,40}$/.test(id)) { res.status(400).json({ error: 'Format ID pesanan tidak valid.' }); return; }
    const rating = Number(req.body?.rating);
    const comment = cleanText(req.body?.comment, 400);
    const displayName = cleanText(req.body?.name, 30) || 'Pelanggan';
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) { res.status(400).json({ error: 'Pilih bintang 1 sampai 5.' }); return; }
    if (comment.length < 5) { res.status(400).json({ error: 'Tulis ulasan minimal 5 karakter.' }); return; }
    try {
      const order = await getDbOrderById(id) as ServerOrderRecord | null;
      if (!order) { res.status(404).json({ error: 'Pesanan tidak ditemukan.' }); return; }
      if (order.fulfillmentStatus !== 'shipped') {
        res.status(409).json({ error: 'Ulasan hanya bisa dikirim setelah pesanan ditandai terkirim oleh Author.' });
        return;
      }
      const outcome = await createReview({ orderId: id, product: String(order.product || '').slice(0, 120), rating, comment, displayName });
      if (outcome === 'exists') { res.status(409).json({ error: 'Pesanan ini sudah pernah diulas. Terima kasih!' }); return; }
      res.status(201).json({ ok: true, message: 'Terima kasih! Ulasan Anda akan tampil setelah diperiksa Author.' });
    } catch (error) {
      console.error('[PostgreSQL] Review create failed:', error);
      res.status(503).json({ error: 'Ulasan belum tersimpan. Coba lagi sebentar.' });
    }
  });

  app.get('/api/orders/:id/review', async (req, res) => {
    const id = String(req.params.id || '').trim().toUpperCase();
    if (!/^CS-[A-Z0-9-]{5,40}$/.test(id)) { res.status(400).json({ error: 'Format ID pesanan tidak valid.' }); return; }
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, reviewed: await hasReviewForOrder(id) });
    } catch {
      res.json({ ok: false, reviewed: false });
    }
  });

  app.get('/api/admin/reviews', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try { res.setHeader('Cache-Control', 'no-store'); res.json({ ok: true, reviews: await listAllReviews() }); }
    catch (error) { console.error('[PostgreSQL] Admin reviews failed:', error); res.status(503).json({ error: 'Ulasan tidak dapat dimuat.' }); }
  });

  app.post('/api/admin/reviews/:rid/:action', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const rid = Number(req.params.rid);
    const action = String(req.params.action);
    if (!Number.isInteger(rid) || !['approve', 'reject', 'delete'].includes(action)) { res.status(400).json({ error: 'Permintaan tidak valid.' }); return; }
    try {
      const ok = action === 'delete' ? await deleteReview(rid) : await setReviewStatus(rid, action === 'approve' ? 'approved' : 'rejected');
      if (!ok) { res.status(404).json({ error: 'Ulasan tidak ditemukan.' }); return; }
      res.json({ ok: true });
    } catch (error) {
      console.error('[PostgreSQL] Review moderation failed:', error);
      res.status(503).json({ error: 'Aksi gagal diproses.' });
    }
  });

  app.post('/api/orders', async (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    if (!(await allowRateLimitedRequest(`create-order:${ip}`, 20, 10 * 60 * 1000))) {
      res.status(429).json({ error: 'Terlalu banyak pembuatan invoice dari koneksi ini. Coba lagi nanti.' });
      return;
    }
    const body = req.body || {};
    const id = String(body.id || '').trim().toUpperCase();
    if (!/^CS-[A-Z0-9-]{5,40}$/.test(id)) {
      res.status(400).json({ error: 'Format ID pesanan tidak valid.' });
      return;
    }

    const paymentId = String(body.paymentId || '').trim().toLowerCase();
    const paymentMethod = PAYMENT_METHODS.find((method) => method.id === paymentId);
    if (!paymentMethod) {
      res.status(400).json({ error: 'Metode pembayaran tidak valid atau belum tersedia.' });
      return;
    }
    if (paymentMethod.isMaintenance) {
      res.status(400).json({ error: 'Metode pembayaran ini belum tersedia. Silakan gunakan QRIS All Payment resmi CAHYO STORE.' });
      return;
    }

    let catalogProducts: typeof INITIAL_PRODUCTS_DATA;
    try { catalogProducts = (await getEffectiveCatalog()).products; }
    catch (error) {
      console.error('[PostgreSQL] Catalog load failed during order creation:', error);
      res.status(503).json({ error: 'Katalog sedang tidak dapat dimuat. Pesanan belum dibuat, coba lagi sebentar.' });
      return;
    }

    const limited = (value: unknown, max: number, fallback = '-') => String(value ?? fallback).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) || fallback;
    const validatedLines: Array<{ productId: string; itemId: string; quantity: number; userId: string; zoneId?: string }> = [];
    let subtotal = 0;
    let totalCount = 0;
    let expectedProduct = '';
    let expectedItem = '';
    let expectedTarget = '';

    if (Array.isArray(body.lineItems)) {
      if (body.lineItems.length < 1 || body.lineItems.length > 20) {
        res.status(400).json({ error: 'Troli harus berisi 1 sampai 20 baris produk.' });
        return;
      }
      for (const input of body.lineItems) {
        const productId = limited(input?.productId, 100, '');
        const itemId = limited(input?.itemId, 100, '');
        const quantity = Number(input?.quantity);
        const userId = limited(input?.userId, 160, '');
        const zoneId = limited(input?.zoneId, 80, '');
        const product = catalogProducts.find((candidate) => candidate.id === productId);
        const item = product?.items.find((candidate) => candidate.id === itemId);
        if (item && item.price <= 0) {
          res.status(400).json({ error: `Harga "${item.name}" belum ditetapkan Author, jadi belum bisa dipesan.` });
          return;
        }
        if (!product || !item || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || !userId) {
          res.status(400).json({ error: 'Salah satu item troli tidak valid menurut katalog server. Perbarui katalog dan buat pesanan baru.' });
          return;
        }
        subtotal += item.price * quantity;
        totalCount += quantity;
        validatedLines.push({ productId, itemId, quantity, userId, ...(zoneId ? { zoneId } : {}) });
      }
      const firstProduct = catalogProducts.find((product) => product.id === validatedLines[0].productId)!;
      expectedProduct = `${firstProduct.name}${validatedLines.length > 1 ? ` +${validatedLines.length - 1} lainnya` : ''}`;
      expectedItem = `${totalCount} Voucher`;
      expectedTarget = validatedLines.map((line) => `${line.userId}${line.zoneId ? `(${line.zoneId})` : ''}`).join(', ');
    } else {
      const productId = String(body.productId ?? '').trim().slice(0, 100);
      const itemId = String(body.itemId ?? '').trim().slice(0, 100);
      const product = catalogProducts.find((candidate) => candidate.id === productId);
      const item = product?.items.find((candidate) => candidate.id === itemId);
      if (item && item.price <= 0) {
        res.status(400).json({ error: `Harga "${item.name}" belum ditetapkan Author, jadi belum bisa dipesan.` });
        return;
      }
      if (!product || !item) {
        res.status(400).json({ error: 'Produk/nominal tidak ditemukan dalam katalog server. Pesanan ditolak agar harga tidak bisa dimanipulasi dari browser.' });
        return;
      }
      const rawTarget = limited(body.target, 240, '');
      if (!rawTarget || rawTarget === '-') {
        res.status(400).json({ error: 'ID/tujuan pesanan wajib diisi.' });
        return;
      }
      subtotal = item.price;
      expectedProduct = product.name;
      expectedItem = item.name;
      expectedTarget = rawTarget;
      validatedLines.push({ productId, itemId, quantity: 1, userId: rawTarget, ...(String(body.target || '').includes('(') ? { zoneId: String(body.target).split('(').pop()?.replace(')', '').trim() } : {}) });
    }

    const uniqueCode = normalizeUniqueCode(body.uniqueCode);
    const expectedTotal = calculateExpectedTotal(subtotal, paymentMethod.fee, uniqueCode);
    if (!totalMatches(body.total, expectedTotal)) {
      res.status(400).json({ error: `Nominal invoice tidak cocok dengan katalog server. Total yang benar: Rp ${expectedTotal.toLocaleString('id-ID')}. Perbarui halaman lalu buat pesanan baru.` });
      return;
    }

    let existing: ServerOrderRecord | null = null;
    try { existing = await getDbOrderById(id) as ServerOrderRecord | null; }
    catch (error) {
      console.error('[PostgreSQL] Order lookup failed:', error);
      res.status(503).json({ error: 'Database sedang tidak dapat diakses. Pesanan belum dibuat.' });
      return;
    }
    if (existing) {
      const sameOrder = existing.product === expectedProduct && String(existing.target || '') === expectedTarget && existing.total === `Rp ${expectedTotal.toLocaleString('id-ID')}`;
      if (sameOrder) {
        res.status(200).json({ ok: true, duplicate: true, order: safePublicOrder(existing) });
      } else {
        res.status(409).json({ error: 'ID pesanan sudah digunakan untuk data yang berbeda.' });
      }
      return;
    }

    const targetsToVerify = Array.from(new Map(
      validatedLines.map((line) => [JSON.stringify([line.productId, line.productId === 'ewallet' ? line.itemId : '', line.userId, line.zoneId || '']), line] as const)
    ).values());
    const allowedVerifications = await Promise.all(targetsToVerify.map(() =>
      allowRateLimitedRequest(`verify-target:${ip}`, 60, 10 * 60 * 1000)
    ));
    if (allowedVerifications.some((allowed) => !allowed)) {
      res.status(429).json({ error: 'Terlalu banyak pemeriksaan ID. Coba lagi beberapa menit lagi.' });
      return;
    }
    const ewalletTargets = targetsToVerify.filter((line) => line.productId === 'ewallet');
    const allowedEwalletChecks = await Promise.all(ewalletTargets.map(() =>
      allowRateLimitedRequest(`verify-ewallet:${ip}`, 12, 10 * 60 * 1000)
    ));
    if (allowedEwalletChecks.some((allowed) => !allowed)) {
      res.status(429).json({ error: 'Batas pemeriksaan e-wallet tercapai. Coba lagi beberapa menit atau periksa nama penerima langsung di aplikasi.' });
      return;
    }

    let targetResults;
    try {
      targetResults = await Promise.all(targetsToVerify.map((line) => {
        const product = catalogProducts.find((candidate) => candidate.id === line.productId)!;
        const item = product.items.find((candidate) => candidate.id === line.itemId);
        return verifyTarget({
          productId: product.id,
          productName: product.name,
          category: product.category,
          idLabel: product.idLabel,
          userId: line.userId,
          zoneId: line.zoneId,
          hasZoneId: product.hasZoneId,
          itemId: item?.id,
          itemName: item?.name,
        });
      }));
    } catch (error) {
      console.error('[VerifyTarget] Order verification failed:', error);
      res.status(503).json({ error: 'Penyedia verifikasi tujuan tidak dapat dihubungi. Pesanan belum dibuat.' });
      return;
    }
    const invalidTarget = targetResults.find((result) => !isTargetAcceptable(result));
    if (invalidTarget) {
      res.status(422).json({
        error: `Tujuan tidak valid menurut pemeriksaan (${invalidTarget.provider}). Periksa kembali ID/nomor tujuan.`,
      });
      return;
    }

    const record: ServerOrderRecord = {
      id,
      product: expectedProduct,
      item: expectedItem,
      target: expectedTarget,
      lineItems: validatedLines,
      // Never trust a status supplied by a customer browser.
      status: 'Menunggu Pembayaran',
      total: `Rp ${expectedTotal.toLocaleString('id-ID')}`,
      uniqueCode,
      payment: paymentMethod.name,
      whatsapp: limited(body.whatsapp, 30),
      // Never trust member identity fields sent by the browser. Bind only to a valid session.
      memberName: getMemberSession(req)?.user.name || 'Guest',
      memberId: getMemberSession(req)?.user.id || '',
      createdAt: new Date().toISOString(),
      paymentStatus: 'pending',
      fulfillmentStatus: 'pending',
      targetVerificationLevel: targetResults.some((result) => result.level === 'format_only') ? 'format_only' : 'confirmed',
      auditLog: [{ action: targetResults.some((result) => result.level === 'format_only') ? 'order_created_target_format_only' : 'order_created', at: new Date().toISOString(), by: 'customer' }]
    };
    try {
      const inserted = await createDbOrder({
        id: record.id, product: record.product, item: record.item,
        target: record.target, status: record.status, total: record.total,
        uniqueCode: record.uniqueCode || 0, payment: record.payment,
        paymentId, paymentStatus: 'pending', fulfillmentStatus: 'pending',
        whatsapp: record.whatsapp, userId: record.memberId || null,
        lineItemsJson: JSON.stringify(record.lineItems || []),
        createdAt: record.createdAt,
        metadata: record as unknown as Record<string, unknown>,
      });
      if (!inserted) {
        res.status(409).json({ error: 'ID pesanan sudah digunakan. Muat ulang halaman dan buat invoice baru.' });
        return;
      }
      await notifyOrderChanged();
      // Dibatasi waktu agar respons ke pembeli tidak tertahan; gagal pun tidak mengganggu order.
      await Promise.race([
        notifyAdminDevicesOfNewOrder().catch((pushError) => console.error('[Push] Notify failed:', pushError)),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch (error) {
      console.error('[PostgreSQL] Order insert failed:', error);
      res.status(503).json({ error: 'Pesanan belum tersimpan di database. Jangan lakukan pembayaran sebelum invoice berhasil dibuat.' });
      return;
    }

    res.status(201).json({ ok: true, order: safePublicOrder(record) });
  });

  app.post('/api/orders/:id/verify-payment', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const id = String(req.params.id || '').trim().toUpperCase();
    const session = getAdminSession(req)!;
    let order: ServerOrderRecord | null = null;
    try { order = await getDbOrderById(id) as ServerOrderRecord | null; }
    catch { res.status(503).json({ error: 'Database sedang tidak dapat diakses.' }); return; }
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (order.paymentStatus === 'verified') {
      res.status(409).json({ error: 'Pembayaran pesanan ini sudah dikonfirmasi sebelumnya.', order });
      return;
    }
    if (/batal|cancel|gagal/i.test(order.status || '')) {
      res.status(409).json({ error: 'Pesanan yang dibatalkan/gagal tidak dapat dikonfirmasi.' });
      return;
    }
    order.paymentStatus = 'verified';
    order.verifiedAt = new Date().toISOString();
    order.status = 'Pembayaran Terverifikasi • Menunggu Pengiriman';
    addAuditEntry(order, 'payment_manually_verified', session.email);
    if (!await persistOrder(order)) {
      res.status(503).json({ error: 'Status pembayaran gagal disimpan ke PostgreSQL.' });
      return;
    }
    res.json({ ok: true, order });
  });

  app.post('/api/orders/:id/mark-shipped', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const id = String(req.params.id || '').trim().toUpperCase();
    const session = getAdminSession(req)!;
    let order: ServerOrderRecord | null = null;
    try { order = await getDbOrderById(id) as ServerOrderRecord | null; }
    catch { res.status(503).json({ error: 'Database sedang tidak dapat diakses.' }); return; }
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (order.paymentStatus !== 'verified') {
      res.status(409).json({ error: 'Pembayaran belum diverifikasi admin. Pesanan tidak dapat ditandai terkirim.' });
      return;
    }
    if (order.fulfillmentStatus === 'shipped') {
      res.status(409).json({ error: 'Pesanan sudah ditandai terkirim sebelumnya.', order });
      return;
    }
    order.fulfillmentStatus = 'shipped';
    order.shippedAt = new Date().toISOString();
    order.status = 'Selesai • Diamond/Produk Sudah Dikirim';
    addAuditEntry(order, 'fulfillment_manually_marked_shipped', session.email);
    if (!await persistOrder(order)) {
      res.status(503).json({ error: 'Status pengiriman gagal disimpan ke PostgreSQL.' });
      return;
    }
    res.json({ ok: true, order });
  });

  app.patch('/api/orders/:id', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const id = String(req.params.id || '').trim().toUpperCase();
    const status = String(req.body?.status || '').trim();
    const session = getAdminSession(req)!;
    let order: ServerOrderRecord | null = null;
    try { order = await getDbOrderById(id) as ServerOrderRecord | null; }
    catch { res.status(503).json({ error: 'Database sedang tidak dapat diakses.' }); return; }
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (/terverifikasi|verified|complete|selesai|terkirim/i.test(status)) {
      res.status(400).json({ error: 'Gunakan tombol Konfirmasi Pembayaran atau Tandai Terkirim agar prasyarat status diperiksa.' });
      return;
    }
    if (order.paymentStatus === 'verified') {
      res.status(409).json({ error: 'Status pesanan yang sudah dibayar tidak dapat diubah lewat endpoint umum.' });
      return;
    }
    if (/batal|cancel/i.test(status)) order.status = 'Dibatalkan';
    else if (/pending|menunggu pembayaran/i.test(status)) order.status = 'Menunggu Pembayaran';
    else if (status) {
      res.status(400).json({ error: 'Status tidak dikenal.' });
      return;
    } else {
      res.status(400).json({ error: 'Status diperlukan.' });
      return;
    }
    addAuditEntry(order, 'status_changed:' + order.status, session.email);
    if (!await persistOrder(order)) {
      res.status(503).json({ error: 'Perubahan status gagal disimpan ke PostgreSQL.' });
      return;
    }
    res.json({ ok: true, order: order });
  });

  app.delete('/api/orders/:id', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const id = String(req.params.id || '').trim().toUpperCase();
    try {
      const deleted = await getDbOrderById(id);
      if (!deleted || !(await deleteDbOrder(id))) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      res.json({ ok: true, deletedId: id, order: deleted, message: 'Pesanan #' + id + ' berhasil dihapus permanen oleh Author.' });
    } catch (error) {
      console.error('[PostgreSQL] Order deletion failed:', error);
      res.status(503).json({ error: 'Pesanan gagal dihapus dari database.' });
    }
  });

  app.delete('/api/orders', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      await clearAllDbOrders();
      res.json({ ok: true, message: 'Seluruh riwayat pesanan masuk berhasil dihapus permanen oleh Author.' });
    } catch (error) {
      console.error('[PostgreSQL] Clearing orders failed:', error);
      res.status(503).json({ error: 'Riwayat pesanan gagal dihapus dari database.' });
    }
  });

  // Endpoint 0B: Real-Time Game ID, Phone Operator, E-Wallet & PLN Meter Verification
  app.post('/api/verify-target', async (req, res) => {
    {
      const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
      if (!(await allowRateLimitedRequest(`verify-target:${ip}`, 60, 10 * 60 * 1000))) {
        res.status(429).json({ error: 'Terlalu banyak permintaan dari koneksi ini. Coba lagi beberapa menit lagi.' });
        return;
      }
    }
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const productId = String(body.productId ?? '').trim().slice(0, 100);
      const itemId = String(body.itemId ?? '').trim().slice(0, 100);
      let catalogProducts = INITIAL_PRODUCTS_DATA;
      try {
        catalogProducts = (await getEffectiveCatalog()).products;
      } catch {
        // A temporary catalog DB issue must not turn a format-only lookup into a false confirmation.
        catalogProducts = INITIAL_PRODUCTS_DATA;
      }
      const product = catalogProducts.find((candidate) => candidate.id === productId);
      if (!product) {
        res.status(400).json({ valid: false, level: 'invalid', provider: 'Katalog server', message: 'Produk tidak ditemukan di katalog server.' });
        return;
      }
      const item = product.items.find((candidate) => candidate.id === itemId);
      const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
      if (product.category === 'ewallet' && item && !(await allowRateLimitedRequest(`verify-ewallet:${ip}`, 12, 10 * 60 * 1000))) {
        res.status(429).json({ valid: true, level: 'format_only', provider: 'Pembatasan permintaan', accountName: `Nomor tujuan: ${String(body.userId || '').trim()}`, regionOrInfo: 'Batas pemeriksaan e-wallet tercapai. Periksa nama penerima langsung di aplikasi.' });
        return;
      }
      const result = await verifyTarget({
        productId: product.id,
        productName: product.name,
        category: product.category,
        idLabel: product.idLabel,
        userId: body.userId,
        zoneId: body.zoneId,
        hasZoneId: product.hasZoneId,
        itemId: item?.id,
        itemName: item?.name,
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ...result, verifiedAt: result.level === 'confirmed' ? new Date().toLocaleTimeString('id-ID') + ' WIB' : undefined });
    } catch (err: any) {
      console.error('[VerifyTarget] Unexpected error:', err);
      res.status(500).json({ valid: false, level: 'invalid', provider: 'Pemeriksaan format', message: 'Pemeriksaan ID gagal. Coba lagi.' });
    }
  });

  // Member API: never return password hashes; registration/login are server-authoritative.
  app.get('/api/users', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    try { res.json({ users: (await getAllDbUsers() as ServerUserRecord[]).map(publicUser) }); }
    catch (error) { console.error('[PostgreSQL] Listing members failed:', error); res.status(503).json({ error: 'Daftar member gagal dimuat.' }); }
  });

  // Legacy sync endpoint is read-only and private; browser-supplied member/admin flags are untrusted.
  app.post('/api/users/sync', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    try { res.json({ ok: true, users: (await getAllDbUsers() as ServerUserRecord[]).map(publicUser) }); }
    catch (error) { console.error('[PostgreSQL] Member sync failed:', error); res.status(503).json({ error: 'Daftar member gagal dimuat.' }); }
  });

  app.post('/api/users/register', async (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    if (!(await allowRateLimitedRequest(`register:${ip}`, 10, 30 * 60 * 1000))) {
      res.status(429).json({ error: 'Terlalu banyak percobaan pendaftaran dari koneksi ini. Coba lagi nanti.' });
      return;
    }
    const body = req.body || {};
    const cleanName = String(body.name || '').trim().slice(0, 100);
    const cleanEmail = String(body.email || '').trim().toLowerCase().slice(0, 254);
    const cleanWa = String(body.whatsapp || '').trim().slice(0, 30);
    const password = String(body.password || '');

    if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanWa.replace(/\D/g, '').length < 9 || password.length < 8) {
      res.status(400).json({ error: 'Data pendaftaran tidak valid. Kata sandi minimal 8 karakter.' });
      return;
    }
    const cleanPhone = cleanWa.replace(/[\s-]/g, '');
    if (isAuthorMatch(cleanEmail) || isAuthorMatch(cleanPhone) || body.isAuthor) {
      res.status(403).json({ error: 'Akun admin tidak dapat dibuat melalui pendaftaran member.' });
      return;
    }

    // O(1) instant duplicate check via high-performance index
    const [existingEmail, existingPhone] = await Promise.all([
      getDbUserByIdentifier(cleanEmail),
      getDbUserByIdentifier(cleanPhone),
    ]);
    if (existingEmail || existingPhone) {
      res.status(409).json({ error: 'Email atau nomor WhatsApp sudah terdaftar.' });
      return;
    }

    const newUser: ServerUserRecord = {
      id: 'MBR-' + randomBytes(6).toString('hex').toUpperCase(),
      name: cleanName,
      email: cleanEmail,
      whatsapp: cleanWa,
      joinedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
      points: 100,
      isAuthor: false,
      passwordHash: hashPassword(password)
    };

    try {
      await upsertDbUser(newUser);
      dbEngine.addUser(newUser);
    } catch (error) {
      console.error('[PostgreSQL] Member registration failed:', error);
      res.status(503).json({ error: 'Akun gagal disimpan ke database. Silakan coba lagi.' });
      return;
    }

    const memberSessionId = randomBytes(32).toString('hex');
    const now = Date.now();
    memberSessions.set(memberSessionId, {
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    try { await saveMemberSessionsToDisk(memberSessions); }
    catch (error) { console.error('[Auth] Failed to save member session:', error); res.status(503).json({ error: 'Akun tersimpan tetapi sesi login gagal dibuat. Silakan masuk kembali.' }); return; }

    const secure = process.env.NODE_ENV === 'production' || req.secure ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `cahyo_member_session=${memberSessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`
    );

    res.status(201).json({
      ok: true,
      user: publicUser(newUser),
      token: memberSessionId,
      message: 'Pendaftaran member berhasil! Bonus 100 poin selamat datang telah ditambahkan.'
    });
  });

  app.post('/api/users/login', async (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    const identifier = String(req.body?.identifier || '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!identifier || !password || password.length > 1024) {
      res.status(400).json({ error: 'Email/nomor WhatsApp dan kata sandi wajib diisi.' });
      return;
    }

    // Author login from the member modal shares the same server-side limit as /api/admin/login.
    if (isAuthorMatch(identifier)) {
      if (!(await allowRateLimitedRequest(`admin-login:${ip}`, 10, 10 * 60 * 1000))) {
        res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' });
        return;
      }
      if (isAuthorPasswordMatch(password)) {
        const sessionEmail = identifier.includes('@') ? identifier : PRIMARY_AUTHOR_EMAIL;
        const sessionId = randomBytes(32).toString('hex');
        const now = Date.now();
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        adminSessions.set(sessionId, { expiresAt: now + THIRTY_DAYS, email: sessionEmail });
        try { await saveAdminSessionsToDisk(adminSessions); }
        catch (error) { adminSessions.delete(sessionId); console.error('[Auth] Admin session persistence failed:', error); res.status(503).json({ error: 'Sesi admin gagal disimpan.' }); return; }
        const secure = process.env.NODE_ENV === 'production' || req.secure ? '; Secure' : '';
        res.setHeader('Set-Cookie', [
          `cahyo_admin_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
          `cahyo_member_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`
        ]);
        res.setHeader('Cache-Control', 'no-store');
        const authorUser = {
          id: 'AUTHOR-01',
          name: 'Author CahyoStore',
          email: sessionEmail,
          whatsapp: '08139525985',
          joinedAt: '1 Jan 2025',
          points: 99999,
          isAuthor: true
        };
        res.json({
          ok: true,
          user: authorUser,
          token: sessionId,
          adminToken: sessionId,
          isAuthor: true,
          message: 'Selamat datang kembali, Author CahyoStore!'
        });
        return;
      } else {
        res.status(401).json({ error: 'Kata sandi Author tidak cocok. Gunakan sandi resmi Author atau periksa penulisan huruf besar/kecil.' });
        return;
      }
    }

    if (!(await allowRateLimitedRequest(`member-login:${ip}`, 15, 10 * 60 * 1000))) {
      res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit.' });
      return;
    }

    // Housekeeping: drop expired session rows (indexed on expires_at); never blocks login on failure.
    await purgeExpiredSessions().catch(() => undefined);

    // O(1) indexed lookup by email or phone
    const matched = await getDbUserByIdentifier(identifier);
    if (!matched) {
      res.status(401).json({ error: 'Akun tidak ditemukan atau kata sandi salah.' });
      return;
    }

    const result = verifyPassword(password, matched.passwordHash);
    if (!result.valid) {
      res.status(401).json({ error: 'Akun tidak ditemukan atau kata sandi salah.' });
      return;
    }

    if (result.needsUpgrade) {
      const upgradedHash = hashPassword(password);
      try { await updateDbUser(matched.id, { passwordHash: upgradedHash }); }
      catch (error) { console.error('[Auth] Password hash upgrade failed:', error); res.status(503).json({ error: 'Peningkatan keamanan akun gagal disimpan. Coba masuk kembali.' }); return; }
      dbEngine.updateUser(matched.id, (u) => { u.passwordHash = upgradedHash; });
    }

    const memberSessionId = randomBytes(32).toString('hex');
    const now = Date.now();
    const memberSession = {
      userId: matched.id,
      email: matched.email,
      name: matched.name,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000
    };
    memberSessions.set(memberSessionId, memberSession);
    try { await saveMemberSessionsToDisk(memberSessions); }
    catch (error) { memberSessions.delete(memberSessionId); console.error('[Auth] Member session persistence failed:', error); res.status(503).json({ error: 'Sesi login gagal disimpan ke database.' }); return; }

    const secure = process.env.NODE_ENV === 'production' || req.secure ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `cahyo_member_session=${memberSessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`
    );
    res.setHeader('Cache-Control', 'no-store');

    res.json({
      ok: true,
      user: publicUser(matched),
      token: memberSessionId,
      message: `Selamat datang kembali, ${matched.name}!`
    });
  });

  // Get current authenticated user profile & points live from server DB
  app.get(['/api/users/me', '/api/users/session'], (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const adminSession = getAdminSession(req);
    if (adminSession) {
      res.json({
        authenticated: true,
        user: {
          id: 'AUTHOR-01',
          name: 'Author CahyoStore',
          email: adminSession.email,
          whatsapp: '08139525985',
          joinedAt: '1 Jan 2025',
          points: 99999,
          isAuthor: true
        }
      });
      return;
    }

    const member = getMemberSession(req);
    if (!member) {
      res.status(401).json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      user: publicUser(member.user)
    });
  });

  app.post('/api/users/logout', async (req, res) => {
    let id = getCookie(req, 'cahyo_member_session');
    if (!id && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      id = req.headers.authorization.slice(7).trim();
    }
    if (!id && req.headers['x-member-token']) {
      id = String(req.headers['x-member-token']).trim();
    }
    if (!id && req.body?.token) {
      id = String(req.body.token).trim();
    }
    if (id) {
      memberSessions.delete(id);
      await deleteDbSession(id);
    }
    const adminToken = extractAdminTokenFromRequest(req);
    if (adminToken) {
      adminSessions.delete(adminToken);
      await deleteDbSession(adminToken);
    }
    const secure = process.env.NODE_ENV === 'production' || req.secure ? '; Secure' : '';
    res.setHeader('Set-Cookie', [
      `cahyo_member_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      `cahyo_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
    ]);
    res.json({ ok: true, message: 'Berhasil keluar dari akun member.' });
  });

  // Member self-service change password
  app.post('/api/users/change-password', async (req, res) => {
    const member = getMemberSession(req);
    if (!member) {
      res.status(401).json({ error: 'Sesi member tidak valid atau kedaluwarsa. Silakan masuk kembali.' });
      return;
    }
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
      res.status(400).json({ error: 'Kata sandi saat ini dan kata sandi baru (minimal 8 karakter) wajib diisi.' });
      return;
    }
    const check = verifyPassword(String(currentPassword), member.user.passwordHash);
    if (!check.valid) {
      res.status(401).json({ error: 'Kata sandi saat ini tidak cocok.' });
      return;
    }
    const passwordHash = hashPassword(String(newPassword));
    try {
      await updateDbUser(member.user.id, { passwordHash });
      dbEngine.updateUser(member.user.id, (u) => { u.passwordHash = passwordHash; });
      res.json({ ok: true, message: 'Kata sandi Anda berhasil diperbarui.' });
    } catch (error) {
      console.error('[Auth] Password change failed:', error);
      res.status(503).json({ error: 'Kata sandi gagal diperbarui di database.' });
    }
  });

  // Member get their own order history
  app.get('/api/users/me/orders', async (req, res) => {
    const member = getMemberSession(req);
    if (!member) {
      res.status(401).json({ error: 'Sesi member tidak valid.' });
      return;
    }
    try {
      const rows = await getDbOrdersForMember(member.user.id, member.user.whatsapp) as ServerOrderRecord[];
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, orders: rows.map(safePublicOrder) });
    } catch (error) {
      console.error('[PostgreSQL] Member orders failed:', error);
      res.status(503).json({ error: 'Riwayat pesanan gagal dimuat.' });
    }
  });

  app.patch('/api/users/:id', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const id = String(req.params.id || '').trim();
    const body = req.body || {};
    try {
      const existing = await getDbUserById(id);
      if (!existing) {
        res.status(404).json({ error: 'Member tidak ditemukan di database.' });
        return;
      }
      const patch: { name?: string; points?: number; passwordHash?: string } = {};
      if (body.password) {
        const password = String(body.password);
        if (password.length < 8 || password.length > 1024) {
          res.status(400).json({ error: 'Kata sandi baru minimal 8 karakter.' });
          return;
        }
        patch.passwordHash = hashPassword(password);
      }
      if (typeof body.points === 'number' && Number.isFinite(body.points)) patch.points = Math.max(0, Math.min(100000000, Math.floor(body.points)));
      if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 100);
      const updated = await updateDbUser(id, patch);
      if (!updated) {
        res.status(404).json({ error: 'Member tidak ditemukan di database.' });
        return;
      }
      const users = await getAllDbUsers() as ServerUserRecord[];
      res.json({ ok: true, user: publicUser(updated as ServerUserRecord), users: users.map(publicUser) });
    } catch (error) {
      console.error('[PostgreSQL] Member update failed:', error);
      res.status(503).json({ error: 'Perubahan member gagal disimpan ke PostgreSQL.' });
    }
  });

  // Payment verification is intentionally disabled unless a real gateway webhook is configured.
  // A timer, browser poll, screenshot, or client-supplied amount is NOT proof of payment.
  app.post('/api/payments/auto-verify', (_req, res) => {
    res.status(503).json({
      orderId: String(_req.body?.orderId || ''),
      verified: false,
      status: 'Menunggu Pembayaran',
      code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      message: 'Akun GoPay Merchant ini belum terhubung ke API/webhook pembayaran. Periksa pembayaran secara manual di aplikasi merchant.'
    });
  });

  // Do not auto-progress orders by elapsed time. Payment and fulfillment must be confirmed
  // independently by trusted gateway/supplier callbacks.

  const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'fityora-store-server'
        }
      }
    });
  };

  const safeParseJson = (rawText?: string) => {
    if (!rawText) return {};
    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  };

  const generateContentWithFallback = async (
    ai: GoogleGenAI,
    params: { contents: any; config?: any }
  ) => {
    try {
      return await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        ...params
      });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('404') || msg.includes('not found') || msg.includes('not supported')) {
        return await ai.models.generateContent({
          model: 'gemini-flash-latest',
          ...params
        });
      }
      throw err;
    }
  };

  // Endpoint 1: AI Smart Budget Optimizer & Combo Recommender
  app.post('/api/ai/recommend', async (req, res) => {
    {
      const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
      if (!(await allowRateLimitedRequest(`ai-recommend:${ip}`, 20, 10 * 60 * 1000))) {
        res.status(429).json({ error: 'Terlalu banyak permintaan dari koneksi ini. Coba lagi beberapa menit lagi.' });
        return;
      }
    }
    try {
      const { budget, gameOrCategory, goal, catalogSummary } = req.body;
      const ai = getAiClient();

      const prompt = `Kamu adalah "CahyoStore AI Concierge", asisten VIP pintar dari CahyoStore (FitYora Store) untuk top-up game & produk digital Indonesia.
Data Input Pelanggan:
- Budget Pelanggan: Rp ${Number(budget || 50000).toLocaleString('id-ID')}
- Game / Kategori Pilihan: ${gameOrCategory || 'Semua Game & Digital'}
- Tujuan / Kebutuhan: ${goal || 'Top up paling worth-it dan hemat'}

Daftar Produk & Harga Resmi CahyoStore:
${JSON.stringify(catalogSummary)}

Tugasmu:
Berikan analisis cerdas dan maksimal 3 rekomendasi item/kombinasi terbaik yang muat atau paling mendekati budget pelanggan dari daftar produk di atas. Pastikan productId dan itemId persis sesuai dengan data katalog yang diberikan.`;

      const response = await generateContentWithFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: {
                type: Type.STRING,
                description: 'Judul rekomendasi singkat yang menarik dan premium.'
              },
              strategySummary: {
                type: Type.STRING,
                description: 'Penjelasan singkat mengapa kombinasi ini paling untung untuk budget pelanggan.'
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.STRING },
                    productName: { type: Type.STRING },
                    itemId: { type: Type.STRING },
                    itemName: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    valueScore: {
                      type: Type.STRING,
                      description: 'Contoh: 99% Worth It / Best Seller / Hemat Maksimal'
                    },
                    reason: {
                      type: Type.STRING,
                      description: 'Alasan singkat memilih nominal ini.'
                    }
                  },
                  required: [
                    'productId',
                    'productName',
                    'itemId',
                    'itemName',
                    'price',
                    'valueScore',
                    'reason'
                  ]
                }
              },
              proTip: {
                type: Type.STRING,
                description: 'Tips hemat pembayaran (misalnya pakai QRIS bebas biaya admin).'
              }
            },
            required: ['headline', 'strategySummary', 'recommendations', 'proTip']
          }
        }
      });

      res.json(safeParseJson(response.text));
    } catch (error: any) {
      res.status(500).json({
        error: error?.message || 'Gagal memproses rekomendasi AI.'
      });
    }
  });

  // Endpoint 2: AI Interactive Gaming & Digital Concierge Chat
  app.post('/api/ai/chat', async (req, res) => {
    {
      const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
      if (!(await allowRateLimitedRequest(`ai-chat:${ip}`, 40, 10 * 60 * 1000))) {
        res.status(429).json({ error: 'Terlalu banyak permintaan dari koneksi ini. Coba lagi beberapa menit lagi.' });
        return;
      }
    }
    if (String(req.body?.message ?? '').length > 2000) {
      res.status(400).json({ error: 'Pesan terlalu panjang (maksimal 2000 karakter).' });
      return;
    }
    try {
      const { message, history, catalogSummary } = req.body;
      const ai = getAiClient();

      // Check if user message mentions an Order ID (e.g. CS-12345)
      const orderMatch = String(message || '')
        .toUpperCase()
        .match(/\bCS-\d{4,6}\b/);
      let orderContext = '';
      if (orderMatch) {
        const foundOrder = await getDbOrderById(orderMatch[0]);
        if (foundOrder) {
          orderContext = `\nStatus pesanan untuk ${orderMatch[0]}: ${JSON.stringify(safePublicOrder(foundOrder))}`;
        } else {
          orderContext = `\nCatatan Server: ID Transaksi ${orderMatch[0]} belum ditemukan di database server.`;
        }
      }

      const systemInstruction = `Kamu adalah "FitYora AI VIP Assistant", asisten kecerdasan buatan resmi CahyoStore (FitYora Store).
Toko melayani 28+ produk top up game & digital:
1. Game Mobile: Mobile Legends (MLBB), Free Fire (FF), PUBG Mobile, Honor of Kings (HOK), Call of Duty Mobile (CODM), Genshin Impact, Honkai Star Rail (HSR), Zenless Zone Zero (ZZZ), Super Sus, FC Mobile, eFootball.
2. PC & Konsol: Point Blank (PB Cash Zepetto), Valorant (VP), Roblox (Robux), Steam Wallet IDR, PlayStation Network (PSN / PS Plus).
3. Utilitas & Digital: Token Listrik PLN (Prabayar 20rb - 1jt), Pulsa Seluler (Telkomsel, Indosat, XL, Axis, Tri, Smartfren), Paket Data Kuota Internet, Saldo E-Wallet (DANA, OVO, GoPay, ShopeePay, LinkAja), Voucher Google Play.
4. Aplikasi Streaming & Sosmed: Netflix (1 & 3 Bulan, 4K UHD), Spotify Premium, YouTube Premium, Canva Pro, Vidio Platinum/Diamond, Koin TikTok, Followers & Likes Instagram.

Panduan Layanan:
- WhatsApp Admin Resmi: 08139525985 (a/n CAHYO)
- Instagram: @fityoraa
- Metode Pembayaran: QRIS Resmi GoPay Merchant (NMID: ID1026469444966) mendukung BCA, DANA, GoPay, OVO, ShopeePay, Mandiri, BRI, BNI.
- Waktu Proses: 1 – 3 menit setelah pembayaran terkonfirmasi.
- Keamanan: 100% legal dan bergaransi resmi tanpa perlu kata sandi / password akun pelanggan.
- Katalog Produk & Nominal Aktif: ${JSON.stringify(catalogSummary)}${orderContext}

Aturan Respon:
1. Jawab pertanyaan pelanggan dalam Bahasa Indonesia yang ramah, sopan, natural, ringkas, dan sangat membantu.
2. Jika pelanggan menanyakan harga atau game tertentu, sebutkan nominal dan harganya dalam format Rupiah, lalu isi suggestedProductId dan suggestedItemId sesuai katalog agar tombol aksi instan muncul.
3. Jika pelanggan menanyakan cara pesan atau cara bayar, jelaskan 4 langkah mudah: Pilih produk -> Isi ID Akun -> Pilih Nominal -> Bayar via QRIS/E-Wallet.
4. Jangan pernah menolak pertanyaan pelanggan terkait produk atau toko. Selalu berikan solusi terbaik.`;

      const response = await generateContentWithFallback(ai, {
        contents: `Riwayat Singkat: ${JSON.stringify(history || [])}\nPertanyaan Pelanggan: ${message}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Jawaban lengkap yang ramah dan informatif.'
              },
              suggestedProductId: {
                type: Type.STRING,
                description: 'ID produk dari katalog jika relevan, atau string kosong jika tidak ada.'
              },
              suggestedItemId: {
                type: Type.STRING,
                description: 'ID nominal item dari katalog jika relevan, atau string kosong jika tidak ada.'
              },
              suggestedLabel: {
                type: Type.STRING,
                description: 'Teks tombol aksi cepat, contoh: Pilih 86 Diamonds (Rp 22.000)'
              }
            },
            required: ['reply', 'suggestedProductId', 'suggestedItemId', 'suggestedLabel']
          }
        }
      });

      res.json(safeParseJson(response.text));
    } catch (error: any) {
      res.status(500).json({
        error: error?.message || 'Gagal menghubungi asisten AI.'
      });
    }
  });

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    // Vite middleware is only for local development. Vercel serves the built public assets.
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send('export function createHotContext() { return { accept() {}, dispose() {}, prune() {}, decline() {}, invalidate() {}, on() {}, off() {}, send() {}, data: {} }; }\nexport function injectQuery(url) { return url; }');
    });
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
  const publicDir = path.join(process.cwd(), 'public');

  // Serve production JS, CSS, and other assets before the SPA fallback.
  app.use(express.static(publicDir, {
    index: false,
    fallthrough: true,
    maxAge: '1y',
    immutable: true,
  }));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Express] Unhandled request error:', error);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Terjadi kesalahan server. Silakan coba lagi.' });
  });

  return app;

}

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const app = await createApp();
export default app;

// Local development uses a normal Node listener. Vercel imports the default Express app
// and runs it as a Function; no long-lived server or JSON-file persistence is used there.
if (!process.env.VERCEL) {
  const server = app.listen(PORT, HOST, () => {
    console.log(`CahyoStore API running on http://${HOST}:${PORT}`);
  });
  server.on('error', (error: any) => {
    console.error('[SERVER ERROR]', error);
  });
}
