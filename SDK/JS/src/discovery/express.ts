import type { Express, Router } from 'express';
import type { Iris } from '../core/client.js';
import type { RouteSchema } from '../core/types.js';
import { dedupeRoutes, normalizePath } from './shared.js';

export async function registerExpressApp(iris: Iris, app: Express): Promise<void> {
  const routes: RouteSchema[] = [];

  function extractRoutes(stack: any[], basePath = '') {
    for (const layer of stack) {
      if (layer.route) {
        // Normal route
        const path = normalizePath(basePath + (layer.route.path === '/' ? '' : layer.route.path));
        for (const method in layer.route.methods) {
          if (layer.route.methods[method]) {
            routes.push({
              path: path || '/',
              method: method.toUpperCase(),
              // Note: Express doesn't easily store schema/description metadata.
            });
          }
        }
      } else if (layer.name === 'router' && layer.handle.stack) {
        // Router middleware
        // Fast hack to extract base path from regex, usually not perfect but best effort
        let routerPath = '';
        if (layer.regexp && layer.regexp.source !== '^\\/?(?=\\/|$)') {
          const match = layer.regexp.source.match(/\\\/([^\\?]+)/);
          if (match) {
            routerPath = '/' + match[1];
          }
        }
        extractRoutes(layer.handle.stack, basePath + routerPath);
      }
    }
  }

  try {
    extractRoutes(app._router.stack);
  } catch (err) {
    iris.emit('discovery:warning', err);
    return;
  }

  const finalRoutes = dedupeRoutes(routes);
  
  if (finalRoutes.length > 0) {
    try {
      await iris.registerRoutes(finalRoutes);
    } catch (err) {
      iris.emit('discovery:warning', err);
    }
  }
}
