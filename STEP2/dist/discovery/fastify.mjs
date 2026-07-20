import { normalizePath, dedupeRoutes } from '../chunk-CC2FOKXI.mjs';

// src/discovery/fastify.ts
async function registerFastifyApp(iris, app) {
  const routes = [];
  app.addHook("onRoute", (routeOptions) => {
    const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method];
    const path = normalizePath(routeOptions.url);
    const schema = routeOptions.schema?.body;
    const description = routeOptions.schema?.description;
    for (const method of methods) {
      routes.push({
        path,
        method: method.toUpperCase(),
        description,
        schema
      });
    }
  });
  app.addHook("onReady", async function() {
    const finalRoutes = dedupeRoutes(routes);
    if (finalRoutes.length > 0) {
      try {
        await iris.registerRoutes(finalRoutes);
      } catch (err) {
        iris.emit("discovery:warning", err);
      }
    }
  });
}

export { registerFastifyApp };
