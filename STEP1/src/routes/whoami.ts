import type { FastifyInstance } from 'fastify';
import { db } from '../services/db.js';
import { Errors } from '../errors/AppError.js';
import * as argon2 from 'argon2';

export async function whoamiRoutes(app: FastifyInstance) {
  app.get('/ingress/whoami', async (req, reply) => {
    // Spec §0.2: verify the Authorization header
    // The client SDK's init() doesn't pass appId, so we find it by token Prefix
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw Errors.unauthorized('Missing or malformed Authorization header');
    }
    const token = authHeader.slice(7);
    const prefix = token.slice(0, 8);
    
    const candidates = await db.application.findMany({
      where: { tokenPrefix: prefix, isActive: true },
    });
    
    let resolvedApp = null;
    for (const candidate of candidates) {
      if (await argon2.verify(candidate.tokenHash, token)) {
        resolvedApp = candidate;
        break;
      }
    }
    
    if (!resolvedApp) {
      throw Errors.unauthorized();
    }

    reply.send({
      id: resolvedApp.id,
      name: resolvedApp.name,
      isActive: resolvedApp.isActive
    });
  });
}
