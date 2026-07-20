import type { FastifyInstance } from 'fastify';
import { db } from '../services/db.js';
import { Errors } from '../errors/AppError.js';
import { RegisterPayload, PublishPayload } from '../schemas/ingress.js';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';

// Reusable function to verify token without appId in path
async function verifyTokenOnly(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw Errors.unauthorized('Missing or malformed Authorization header');
  }
  const token = authHeader.slice(7);
  const prefix = token.slice(0, 8);
  
  const candidates = await db.application.findMany({
    where: { tokenPrefix: prefix, isActive: true },
  });
  
  for (const candidate of candidates) {
    if (await argon2.verify(candidate.tokenHash, token)) {
      return candidate;
    }
  }
  throw Errors.unauthorized();
}

export async function ingressRoutes(app: FastifyInstance) {
  // §1.4 Flow B — POST /ingress/register
  app.post('/ingress/register', async (req, reply) => {
    const resolvedApp = await verifyTokenOnly(req.headers.authorization);
    
    const parsed = RegisterPayload.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest('Invalid payload schema');
    }
    const routes = parsed.data;

    // Replace inside transaction
    await db.$transaction(async (tx) => {
      await tx.route.deleteMany({ where: { applicationId: resolvedApp.id } });
      if (routes.length > 0) {
        // Handle deduplication to avoid unique constraint errors just in case
        const seen = new Set();
        const validRoutes = [];
        for (const r of routes) {
          const key = `${r.path}:${r.method}`;
          if (!seen.has(key)) {
            seen.add(key);
            validRoutes.push(r);
          }
        }
        await tx.route.createMany({
          data: validRoutes.map(r => ({
            applicationId: resolvedApp.id,
            path: r.path,
            method: r.method,
            description: r.description,
            schema: r.schema ? JSON.parse(JSON.stringify(r.schema)) : null
          }))
        });
      }
      await tx.routeSyncLog.create({
        data: {
          applicationId: resolvedApp.id,
          routeCount: routes.length,
          sourceIp: req.ip
        }
      });
    });

    reply.send({ status: 'ok', routeCount: routes.length });
  });

  // §1.4 Flow C — POST /ingress/publish
  app.post('/ingress/publish', async (req, reply) => {
    const resolvedApp = await verifyTokenOnly(req.headers.authorization);
    
    const parsed = PublishPayload.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest('Invalid payload schema');
    }
    const { event, data, idempotencyKey } = parsed.data;
    
    const actualKey = idempotencyKey || randomUUID();

    try {
      await db.eventOutbox.create({
        data: {
          applicationId: resolvedApp.id,
          event,
          routingKey: `${resolvedApp.name}.${event}`,
          payload: JSON.parse(JSON.stringify(data)),
          idempotencyKey: actualKey
        }
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Unique constraint failed on idempotencyKey. Just accept it as a duplicate (idempotent).
      } else {
        throw err;
      }
    }

    reply.status(202).send({ status: 'accepted', idempotencyKey: actualKey });
  });
}
