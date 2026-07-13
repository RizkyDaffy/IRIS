// src/discovery/shared.ts
function normalizePath(path) {
  return path.replace(/\/+/g, "/");
}
function dedupeRoutes(routes) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const r of routes) {
    const key = `${r.method.toUpperCase()} ${r.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

export { dedupeRoutes, normalizePath };
