// §3.3 View B — API Explorer /app/[appId]/docs
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { irisCore, ApiError } from '@/lib/iris-core-client';
import { MethodBadge } from '@/components/ui/method-badge';
import { CopyCurlButton } from '@/components/ui/copy-curl-button';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ appId: string }>;
  searchParams: Promise<{ method?: string; search?: string }>;
}

export async function generateMetadata({ params }: Props) {
  return { title: `Iris Portal — API Docs` };
}

export default async function DocsPage({ params, searchParams }: Props) {
  const { appId } = await params;
  const sp = await searchParams;
  let app;
  try {
    app = await irisCore.getApp(appId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  // Filter state in URL per spec §3.3
  const methodFilter = sp.method?.toUpperCase() ?? '';
  const searchFilter = sp.search?.toLowerCase() ?? '';

  const routes = app.routes.filter(r => {
    if (methodFilter && r.method !== methodFilter) return false;
    if (searchFilter && !r.path.toLowerCase().includes(searchFilter)) return false;
    return true;
  });

  // §0.6 — curl example uses the gateway base URL, no trailing slash
  const gatewayBase = (process.env.IRIS_GATEWAY_URL || 'http://localhost:3001').replace(/\/$/, '');

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500 mb-4">
        <Link href="/" className="hover:text-slate-300 transition-colors">Catalog</Link>
        <span className="mx-2">/</span>
        <Link href={`/app/${appId}`} className="hover:text-slate-300 transition-colors">{app.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-white">API Docs</span>
      </nav>

      <h1 className="text-2xl font-bold text-white mb-6">{app.name} — API Explorer</h1>

      {/* Filters — state in URL query string per §3.3 */}
      <form className="flex gap-2 mb-6" method="get">
        <input
          id="route-search"
          name="search"
          defaultValue={sp.search}
          placeholder="Filter by path…"
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 w-64"
        />
        <select
          id="method-filter"
          name="method"
          defaultValue={sp.method ?? ''}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
        >
          <option value="">All methods</option>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
        >
          Filter
        </button>
        {(methodFilter || searchFilter) && (
          <Link
            href={`/app/${appId}/docs`}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Route list */}
      {routes.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          {app.routes.length === 0
            ? 'No routes registered yet. Start your app with the SDK to sync routes.'
            : 'No routes match the current filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map(route => {
            // §0.1 §3.3 — curl includes auth header, uses appId not token in URL
            const curl = `curl -X ${route.method} \\
  '${gatewayBase}/app/${appId}/api${route.path}' \\
  -H 'Authorization: Bearer <your-token>'`;

            return (
              <details
                key={route.id}
                id={`route-${route.id}`}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group"
              >
                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors list-none">
                  <MethodBadge method={route.method} />
                  <code className="text-slate-200 text-sm font-mono flex-1">{route.path}</code>
                  {route.description && (
                    <span className="text-slate-500 text-xs truncate max-w-xs">{route.description}</span>
                  )}
                  <span className="text-slate-600 text-xs">▼</span>
                </summary>
                <div className="px-4 pb-4 border-t border-slate-800 pt-4 space-y-3">
                  {route.description && (
                    <p className="text-slate-400 text-sm">{route.description}</p>
                  )}
                  {/* §3.3 — schema rendered through React default escaping, never dangerouslySetInnerHTML */}
                  {route.schema && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1 font-medium">Request Schema</p>
                      <pre className="bg-slate-950 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto">
                        {JSON.stringify(route.schema, null, 2)}
                      </pre>
                    </div>
                  )}
                  {/* Copy curl — includes auth header §3.3 */}
                  <div>
                    <p className="text-xs text-slate-500 mb-1 font-medium">Example</p>
                    <div className="relative">
                      <pre
                        id={`curl-${route.id}`}
                        className="bg-slate-950 rounded-lg p-3 text-xs text-emerald-300/80 overflow-x-auto pr-20"
                      >
                        {curl}
                      </pre>
                      <CopyCurlButton text={curl} id={`copy-curl-${route.id}`} />
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
