import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db.js';
import { generateToken, invalidateApp } from '../middleware/auth.js';
import { Errors } from '../errors/AppError.js';
import { isAllowedTarget, config } from '../config/env.js';

const CreateAppBody = z.object({
  name: z.string().min(1).max(128),
  targetUrl: z.string().url(),
});

const UpdateAppBody = z.object({
  targetUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

// §0.3 — portal mutations go through iris-core's admin API, never writes DB directly
export async function adminRoutes(app: FastifyInstance) {
  // Admin key guard: if IRIS_ADMIN_KEY is set, every /admin/* request must supply it.
  // In dev with no key set, routes are open (intentional). In prod, env.ts crashes at boot if unset.
  app.addHook('preHandler', async (req, reply) => {
    if (config.IRIS_ADMIN_KEY) {
      const provided = req.headers['x-iris-admin-key'] as string | undefined;
      if (!provided || provided !== config.IRIS_ADMIN_KEY) {
        reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Iris-Admin-Key', requestId: req.id } });
      }
    }
  });

  // POST /admin/applications — create app, return plaintext token exactly once
  app.post('/admin/applications', async (req, reply) => {
    const parsed = CreateAppBody.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }
    const { name, targetUrl } = parsed.data;

    if (!isAllowedTarget(targetUrl)) {
      throw Errors.badRequest('targetUrl is not within the allowed CIDR ranges');
    }

    const { token, tokenHash, tokenPrefix } = await generateToken();

    let app_record;
    try {
      app_record = await db.application.create({
        data: { name, targetUrl, tokenHash, tokenPrefix },
      });
    } catch (err: any) {
      if (err.code === 'P2002') throw Errors.badRequest(`Application name "${name}" already exists`);
      throw err;
    }

    // Token shown exactly once — §0.1
    reply.status(201).send({
      id: app_record.id,
      name: app_record.name,
      targetUrl: app_record.targetUrl,
      isActive: app_record.isActive,
      createdAt: app_record.createdAt,
      token, // plaintext — only here, never stored again
    });
  });

  // GET /admin/applications — list all (for portal Service Catalog)
  app.get('/admin/applications', async (_req, reply) => {
    const apps = await db.application.findMany({
      select: {
        id: true, name: true, targetUrl: true,
        isActive: true, createdAt: true, updatedAt: true,
        _count: { select: { routes: true, outboxItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    reply.send(apps);
  });

  // GET /admin/applications/:id — single app with routes
  app.get('/admin/applications/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const app_record = await db.application.findUnique({
      where: { id },
      include: {
        routes: { orderBy: [{ method: 'asc' }, { path: 'asc' }] },
        routeSyncs: { orderBy: { syncedAt: 'desc' }, take: 5 },
        _count: { select: { outboxItems: true } },
      },
    });
    if (!app_record) throw Errors.applicationNotFound();
    reply.send(app_record);
  });

  // PATCH /admin/applications/:id — update targetUrl or isActive (token rotation separate)
  app.patch('/admin/applications/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = UpdateAppBody.safeParse(req.body);
    if (!parsed.success) throw Errors.badRequest('Invalid body');
    const { targetUrl, isActive } = parsed.data;

    if (targetUrl && !isAllowedTarget(targetUrl)) {
      throw Errors.badRequest('targetUrl is not within the allowed CIDR ranges');
    }

    const existing = await db.application.findUnique({ where: { id } });
    if (!existing) throw Errors.applicationNotFound();

    const updated = await db.application.update({
      where: { id },
      data: { ...(targetUrl && { targetUrl }), ...(isActive !== undefined && { isActive }) },
    });
    reply.send(updated);
  });

  // POST /admin/applications/:id/rotate-token — rotate, return new token once
  app.post('/admin/applications/:id/rotate-token', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await db.application.findUnique({ where: { id } });
    if (!existing) throw Errors.applicationNotFound();

    const { token, tokenHash, tokenPrefix } = await generateToken();
    await db.application.update({ where: { id }, data: { tokenHash, tokenPrefix } });

    // Immediately evict old token from in-process cache — closes 30s rotation race window
    invalidateApp(id);

    reply.send({ token }); // shown once
  });

  // GET /admin/applications/:id/events — paginated outbox events
  app.get('/admin/applications/:id/events', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, cursor, limit = '50' } = req.query as { status?: string; cursor?: string; limit?: string };

    const where: any = { applicationId: id };
    if (status) where.status = status;
    if (cursor) where.createdAt = { lt: new Date(cursor) };

    const rows = await db.eventOutbox.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit, 10), 200),
      select: {
        id: true, event: true, routingKey: true, status: true,
        attempts: true, lastError: true, createdAt: true, publishedAt: true,
        idempotencyKey: true,
      },
    });
    reply.send(rows);
  });
}
