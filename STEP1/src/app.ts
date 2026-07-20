import fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import promClient from 'prom-client';
import { config } from './config/env.js';
import { db } from './services/db.js';
import { connectBroker, closeBroker } from './services/broker.js';
import { startOutboxWorker, stopOutboxWorker } from './workers/outboxWorker.js';
import { healthRoutes } from './routes/health.js';
import { whoamiRoutes } from './routes/whoami.js';
import { ingressRoutes } from './routes/ingress.js';
import { proxyRoutes } from './routes/proxy.js';
import { adminRoutes } from './routes/admin.js';
import { securityRoutes } from './routes/securityAudit.js';
import { AppError } from './errors/AppError.js';

const app = fastify({
  logger: {
    level: config.LOG_LEVEL,
    redact: ['req.headers.authorization'],
  },
  bodyLimit: 10485760 // 10MB
});

// Prometheus metrics setup
promClient.collectDefaultMetrics();
const proxyLatency = new promClient.Histogram({
  name: 'iris_proxy_latency_seconds',
  help: 'Proxy request latency in seconds',
  labelNames: ['appId', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

// @rizkydaffy: basic metrics endpoint
// If METRICS_KEY is set, require Authorization: Bearer <METRICS_KEY> — prevents operational intel leak
app.get('/metrics', { logLevel: 'silent' }, async (req, reply) => {
  if (config.METRICS_KEY) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${config.METRICS_KEY}`) {
      reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid metrics key', requestId: req.id } });
      return;
    }
  }
  reply.header('Content-Type', promClient.register.contentType);
  return promClient.register.metrics();
});

// Plugins
app.register(helmet);
app.register(rateLimit, {
  max: 100, // global basic limit, can be overridden per route
  timeWindow: '1 minute'
});

// Routes
app.register(healthRoutes);
app.register(whoamiRoutes);
app.register(ingressRoutes);
app.register(proxyRoutes);
app.register(adminRoutes);
app.register(securityRoutes);

// Error handler (shared envelope §0.5)
app.setErrorHandler((error, req, reply) => {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send(error.toJSON(req.id));
    return;
  }
  if (error.validation) {
    reply.status(400).send({
      error: { code: 'BAD_REQUEST', message: error.message, requestId: req.id }
    });
    return;
  }

  app.log.error(error);
  reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: req.id }
  });
});

// Lifecycle
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info('Shutting down gracefully...');

  setTimeout(() => process.exit(1), 10_000).unref(); // Force kill after 10s

  await stopOutboxWorker();
  await app.close();
  await closeBroker();
  await db.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function start() {
  try {
    await db.$connect();
    await connectBroker();
    startOutboxWorker();

    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Gateway listening on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
