import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  RABBITMQ_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TOKEN_CACHE_TTL_MS: z.coerce.number().default(15_000),
  // @rizkydaffy: CIDR list parsed at startup — validated once, not per-request
  ALLOWED_TARGET_CIDRS: z.string().default('10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.0/8'),
  // Security hardening — new vars, all optional with safe defaults
  NODE_ENV: z.string().default('development'),
  // IRIS_ADMIN_KEY: guards /admin/* routes. Required in production.
  IRIS_ADMIN_KEY: z.string().optional(),
  // METRICS_KEY: if set, /metrics requires Authorization: Bearer <METRICS_KEY>
  METRICS_KEY: z.string().optional(),
  // EVENT_RETENTION_DAYS: outbox purge — published events older than N days get deleted. 0 = disabled.
  EVENT_RETENTION_DAYS: z.coerce.number().default(90),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

export const config = parseEnv();

// Fail-fast: production with no admin key = open admin routes = unacceptable
if (config.NODE_ENV === 'production' && !config.IRIS_ADMIN_KEY) {
  throw new Error(
    '[IRIS] FATAL: NODE_ENV=production but IRIS_ADMIN_KEY is not set. ' +
    'Admin routes would be unauthenticated. Set IRIS_ADMIN_KEY in your environment.'
  );
}

// Pre-parse CIDRs into { ip: bigint, mask: bigint }[] for fast per-request checks
export const allowedCidrs = config.ALLOWED_TARGET_CIDRS.split(',').map((cidr) => {
  const [ip, bits] = cidr.trim().split('/');
  const ipNum = ipToBigInt(ip!);
  const mask = bits ? ~((1n << BigInt(32 - parseInt(bits))) - 1n) & 0xFFFF_FFFFn : 0xFFFF_FFFFn;
  return { ip: ipNum & mask, mask };
});

function ipToBigInt(ip: string): bigint {
  return ip.split('.').reduce((acc, octet) => (acc << 8n) | BigInt(parseInt(octet)), 0n);
}

// @rizkydaffy: hostnames like 'localhost' or service names ('api-service') are allowed
// IPs are validated against ALLOWED_TARGET_CIDRS; hostnames are trusted (internal network)
export function isAllowedTarget(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    // If it looks like an IP, check against CIDRs
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      const ipNum = ipToBigInt(hostname);
      return allowedCidrs.some(({ ip, mask }) => (ipNum & mask) === ip);
    }
    // Hostname-based (localhost, service names) — allowed, operator controls network isolation
    return true;
  } catch {
    return false;
  }
}
