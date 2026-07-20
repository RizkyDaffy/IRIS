import { createHash } from 'crypto';
import * as argon2 from 'argon2';
import { config } from '../config/env.js';
import { db } from '../services/db.js';
import type { Application } from '@prisma/client';
import { Errors } from '../errors/AppError.js';

// §1.4 Flow A — token cache keyed by SHA-256(raw token), NOT the raw token
// @rizkydaffy: in-process Map, no Redis dep needed for phase 1
const cache = new Map<string, { appId: string; expiresAt: number }>();
// Secondary index: appId → Set of cache keys — enables immediate invalidation on token rotation
const appCacheKeys = new Map<string, Set<string>>();

function cacheKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function pruneExpired() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
  }
}

/**
 * Resolves an application by appId, verifies the Bearer token.
 * Throws AppError on any failure — callers just let it propagate to the error handler.
 */
export async function resolveAndVerify(appId: string, authHeader: string | undefined): Promise<Application> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw Errors.unauthorized('Missing or malformed Authorization header');
  }
  const token = authHeader.slice(7);

  // Cache hit
  const key = cacheKey(token);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now() && hit.appId === appId) {
    const app = await db.application.findUnique({ where: { id: appId } });
    if (!app || !app.isActive) throw Errors.applicationNotFound();
    return app;
  }

  // DB lookup — use tokenPrefix to narrow candidates
  const prefix = token.slice(0, 8);
  const app = await db.application.findFirst({
    where: { id: appId, tokenPrefix: prefix, isActive: true },
  });
  if (!app) throw Errors.applicationNotFound();

  const valid = await argon2.verify(app.tokenHash, token);
  if (!valid) throw Errors.unauthorized();

  // Cache successful verification
  pruneExpired();
  cache.set(key, { appId, expiresAt: Date.now() + config.TOKEN_CACHE_TTL_MS });
  // Track key under appId for invalidation
  if (!appCacheKeys.has(appId)) appCacheKeys.set(appId, new Set());
  appCacheKeys.get(appId)!.add(key);

  return app;
}

/** Used only at app creation to generate a plaintext token + its stored hash/prefix */
export async function generateToken(): Promise<{ token: string; tokenHash: string; tokenPrefix: string }> {
  // @rizkydaffy: 32 random bytes → hex string = 64 chars, URL-safe
  const { randomBytes } = await import('crypto');
  const token = randomBytes(32).toString('hex');
  const tokenHash = await argon2.hash(token, { type: argon2.argon2id });
  const tokenPrefix = token.slice(0, 8);
  return { token, tokenHash, tokenPrefix };
}

/**
 * Immediately evicts all cached token verifications for an appId.
 * Call after token rotation — closes the TTL race window.
 */
export function invalidateApp(appId: string): void {
  const keys = appCacheKeys.get(appId);
  if (!keys) return;
  for (const k of keys) cache.delete(k);
  appCacheKeys.delete(appId);
}
