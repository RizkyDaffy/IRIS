import type { FastifyInstance } from 'fastify';
import type { Iris } from '../core/client.js';
import type { RouteSchema } from '../core/types.js';
import { dedupeRoutes, normalizePath } from './shared.js';

export async function registerFastifyApp(iris: Iris, app: FastifyInstance): Promise<void> {
  const routes: RouteSchema[] = [];

  app.addHook('onRoute', (routeOptions) => {
    const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method];
    const path = normalizePath(routeOptions.url);
    
    // Attempt to extract json schema if available
    const schema = routeOptions.schema?.body as Record<string, unknown> | undefined;
    const description = (routeOptions.schema as any)?.description as string | undefined;

    for (const method of methods) {
      routes.push({
        path,
        method: method.toUpperCase(),
        description,
        schema,
      });
    }
  });

  // Fastify registers routes on ready
  app.addHook('onReady', async function () {
    const finalRoutes = dedupeRoutes(routes);
    if (finalRoutes.length > 0) {
      try {
        await iris.registerRoutes(finalRoutes);
      } catch (err) {
        iris.emit('discovery:warning', err);
      }
    }
  });
}
