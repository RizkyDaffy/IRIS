import type { FastifyInstance } from 'fastify';
import { getBrokerState } from '../services/broker.js';
import { db } from '../services/db.js';

// §0.2 — /healthz liveness (no auth, no deps), /readyz readiness (checks Postgres + AMQP)
export async function healthRoutes(app: FastifyInstance) {
  app.get('/healthz', { logLevel: 'silent' }, async (_req, reply) => {
    reply.send({ status: 'ok' });
  });

  app.get('/readyz', { logLevel: 'silent' }, async (_req, reply) => {
    let dbOk = false;
    try {
      await db.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch { /* fall through */ }

    const brokerState = getBrokerState();
    const brokerOk = brokerState === 'connected';

    const ok = dbOk && brokerOk;
    reply.status(ok ? 200 : 503).send({
      status: ok ? 'ok' : 'degraded',
      checks: { db: dbOk ? 'ok' : 'fail', broker: brokerState },
    });
  });
}
