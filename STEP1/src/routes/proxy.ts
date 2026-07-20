import type { FastifyInstance } from 'fastify';
import { resolveAndVerify } from '../middleware/auth.js';
import { isAllowedTarget } from '../config/env.js';
import { Errors } from '../errors/AppError.js';
import { request } from 'undici';

// §1.4 Flow A — Reverse Proxy
export async function proxyRoutes(app: FastifyInstance) {
  // @rizkydaffy: proxy using undici directly, fastify-http-proxy can be too heavy or complex to 
  // hook into for our specific manual auth and URL routing. Undici stream is one line.

  app.all('/app/:appId/api/*', async (req, reply) => {
    const { appId } = req.params as { appId: string };
    const authHeader = req.headers.authorization;

    const resolvedApp = await resolveAndVerify(appId, authHeader);

    if (!isAllowedTarget(resolvedApp.targetUrl)) {
      throw Errors.badGateway('Target URL is not in allowed CIDRs');
    }

    const path = (req.params as any)['*'];
    const query = req.raw.url?.split('?')[1] ? `?${req.raw.url.split('?')[1]}` : '';
    const targetUrl = new URL(resolvedApp.targetUrl.replace(/\/$/, '') + '/' + path + query);

    const headers = { ...req.headers };
    // Strip hop-by-hop
    const strip = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'host'];
    for (const h of strip) delete headers[h];

    headers['x-request-id'] = req.id;
    headers['x-forwarded-for'] = req.ip;

    try {
      const { statusCode, headers: resHeaders, body } = await request(targetUrl, {
        method: req.method as any,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : (req.raw as any),
        throwOnError: false,
        bodyTimeout: 10_000,
        headersTimeout: 10_000
      });

      reply.status(statusCode);
      for (const [k, v] of Object.entries(resHeaders)) {
        if (v) reply.header(k, v);
      }
      return reply.send(body);
    } catch (err: any) {
      app.log.error(err);
      if (err.code === 'UND_ERR_HEADERS_TIMEOUT' || err.code === 'UND_ERR_BODY_TIMEOUT') {
        throw Errors.gatewayTimeout();
      }
      throw Errors.badGateway();
    }
  });
}
