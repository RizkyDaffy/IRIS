'use strict';

var chunkES4OQZIP_js = require('../chunk-ES4OQZIP.js');

// src/discovery/express.ts
async function registerExpressApp(iris, app) {
  const routes = [];
  function extractRoutes(stack, basePath = "") {
    for (const layer of stack) {
      if (layer.route) {
        const path = chunkES4OQZIP_js.normalizePath(basePath + (layer.route.path === "/" ? "" : layer.route.path));
        for (const method in layer.route.methods) {
          if (layer.route.methods[method]) {
            routes.push({
              path: path || "/",
              method: method.toUpperCase()
              // Note: Express doesn't easily store schema/description metadata.
            });
          }
        }
      } else if (layer.name === "router" && layer.handle.stack) {
        let routerPath = "";
        if (layer.regexp && layer.regexp.source !== "^\\/?(?=\\/|$)") {
          const match = layer.regexp.source.match(/\\\/([^\\?]+)/);
          if (match) {
            routerPath = "/" + match[1];
          }
        }
        extractRoutes(layer.handle.stack, basePath + routerPath);
      }
    }
  }
  try {
    extractRoutes(app._router.stack);
  } catch (err) {
    iris.emit("discovery:warning", err);
    return;
  }
  const finalRoutes = chunkES4OQZIP_js.dedupeRoutes(routes);
  if (finalRoutes.length > 0) {
    try {
      await iris.registerRoutes(finalRoutes);
    } catch (err) {
      iris.emit("discovery:warning", err);
    }
  }
}

exports.registerExpressApp = registerExpressApp;
