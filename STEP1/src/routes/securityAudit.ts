import type { FastifyInstance } from 'fastify';
import { db } from '../services/db.js';
import { config } from '../config/env.js';
import { Errors } from '../errors/AppError.js';

/**
 * Security Audit Routes — new additive endpoints for CySec/SRE visibility.
 * All endpoints require IRIS_ADMIN_KEY header (same guard as admin routes).
 * Read-only — no mutations.
 *
 * GET /security/token-anomalies   — apps with unusual auth failure spikes
 * GET /security/inactive-apps     — deactivated apps still holding routes/events
 * GET /security/outbox-health     — failed events, retry exhaustion summary
 * GET /security/sync-frequency    — apps that over-register (route spam detection)
 */
export async function securityRoutes(app: FastifyInstance) {
  // Require admin key — same pattern as admin routes
  app.addHook('preHandler', async (req, reply) => {
    if (config.IRIS_ADMIN_KEY) {
      const provided = req.headers['x-iris-admin-key'] as string | undefined;
      if (!provided || provided !== config.IRIS_ADMIN_KEY) {
        reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Iris-Admin-Key', requestId: req.id },
        });
      }
    }
  });

  /**
   * GET /security/token-anomalies
   * Returns apps that have had failed route syncs recently — proxy for token misuse attempts.
   * Lightweight: reads RouteSyncLog for apps with syncs in last 1h, compares to expected pattern.
   * A real anomaly detector would use metrics; this is a good-enough DB-based approximation for now.
   */
  app.get('/security/token-anomalies', async (req, reply) => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Apps with high sync frequency in last hour (>10 syncs = suspicious rotation or bot)
    const highFrequency = await db.routeSyncLog.groupBy({
      by: ['applicationId'],
      where: { syncedAt: { gte: oneHourAgo } },
      _count: { id: true },
      having: { id: { _count: { gt: 10 } } },
    });

    const appIds = highFrequency.map((r) => r.applicationId);
    const apps = appIds.length > 0
      ? await db.application.findMany({
          where: { id: { in: appIds } },
          select: { id: true, name: true, isActive: true, targetUrl: true, updatedAt: true },
        })
      : [];

    const result = apps.map((a) => {
      const freq = highFrequency.find((r) => r.applicationId === a.id);
      return { ...a, syncCountLastHour: freq?._count.id ?? 0, anomalyReason: 'HIGH_SYNC_FREQUENCY' };
    });

    // Also flag apps inactive but still have pending outbox events
    const inactiveWithPending = await db.application.findMany({
      where: {
        isActive: false,
        outboxItems: { some: { status: 'pending' } },
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        _count: { select: { outboxItems: true } },
      },
    });

    reply.send({
      highFrequencySyncs: result,
      inactiveAppsWithPendingEvents: inactiveWithPending.map((a) => ({
        ...a,
        anomalyReason: 'INACTIVE_APP_PENDING_EVENTS',
      })),
      generatedAt: new Date().toISOString(),
    });
  });

  /**
   * GET /security/outbox-health
   * Summary of outbox by status — shows stuck events, retry exhaustion, and undelivered volumes.
   * Use this when monitoring message delivery health or investigating broker issues.
   */
  app.get('/security/outbox-health', async (_req, reply) => {
    const [byStatus, failedSample, oldestPending] = await Promise.all([
      db.eventOutbox.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      // Sample of recently failed events for triage
      db.eventOutbox.findMany({
        where: { status: 'failed' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          applicationId: true,
          event: true,
          attempts: true,
          lastError: true,
          createdAt: true,
        },
      }),
      // Oldest pending event — if very old, broker may be stuck
      db.eventOutbox.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, applicationId: true, event: true, createdAt: true, attempts: true },
      }),
    ]);

    const statusSummary = Object.fromEntries(byStatus.map((r) => [r.status, r._count.id]));

    reply.send({
      statusSummary,
      oldestPendingEvent: oldestPending ?? null,
      recentFailedSample: failedSample,
      generatedAt: new Date().toISOString(),
    });
  });

  /**
   * GET /security/inactive-apps
   * Lists deactivated apps. Useful for cleanup audits — apps that are off but still registered.
   * An inactive app with many routes is a sign it was shut down without cleanup.
   */
  app.get('/security/inactive-apps', async (_req, reply) => {
    const inactive = await db.application.findMany({
      where: { isActive: false },
      select: {
        id: true,
        name: true,
        targetUrl: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { routes: true, outboxItems: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    reply.send({ inactive, total: inactive.length, generatedAt: new Date().toISOString() });
  });

  /**
   * GET /security/sync-frequency?appId=&hours=24
   * Shows sync history for a given app — helps detect replay attacks or misconfigured SDK boot loops.
   */
  app.get('/security/sync-frequency', async (req, reply) => {
    const { appId, hours = '24' } = req.query as { appId?: string; hours?: string };
    if (!appId) throw Errors.badRequest('appId query param required');

    const since = new Date(Date.now() - parseInt(hours, 10) * 60 * 60 * 1000);

    const [app, syncs] = await Promise.all([
      db.application.findUnique({
        where: { id: appId },
        select: { id: true, name: true, isActive: true },
      }),
      db.routeSyncLog.findMany({
        where: { applicationId: appId, syncedAt: { gte: since } },
        orderBy: { syncedAt: 'desc' },
        take: 100,
        select: { id: true, routeCount: true, sourceIp: true, syncedAt: true },
      }),
    ]);

    if (!app) throw Errors.applicationNotFound();

    reply.send({
      app,
      syncCountInWindow: syncs.length,
      windowHours: parseInt(hours, 10),
      syncs,
      generatedAt: new Date().toISOString(),
    });
  });
}
