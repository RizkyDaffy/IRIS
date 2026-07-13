import type { RouteSchema } from '../core/types.js';

export function normalizePath(path: string): string {
  // Replace express-style parameters :param with openapi style {param} or keep them standard
  // Spec doesn't strictly dictate, but normalized shapes are better.
  return path.replace(/\/+/g, '/');
}

export function dedupeRoutes(routes: RouteSchema[]): RouteSchema[] {
  const seen = new Set<string>();
  const out: RouteSchema[] = [];
  for (const r of routes) {
    const key = `${r.method.toUpperCase()} ${r.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}
