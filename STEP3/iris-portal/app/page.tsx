// §3.3 View A — Service Catalog
// Server Component — data fetched at request time
import Link from 'next/link';
import { irisCore, type App } from '@/lib/iris-core-client';
import { CreateAppDialog } from '@/components/create-app-dialog';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Iris Portal — Service Catalog',
  description: 'All registered Iris applications and their status',
};

async function AppTable() {
  let apps: App[] = [];
  let fetchError: string | null = null;
  try {
    apps = await irisCore.listApps();
  } catch (err: any) {
    fetchError = err.message;
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-6 text-red-400 text-sm">
        Failed to connect to iris-core: {fetchError}
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 p-12 text-center text-slate-500">
        No applications yet. Create one to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/50">
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Target</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Routes</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {apps.map(app => (
            <tr
              key={app.id}
              className="border-b border-slate-800/50 hover:bg-slate-900/40 transition-colors"
            >
              <td className="px-4 py-3">
                {/* §0.1 — URL uses non-secret id, never token */}
                <Link
                  href={`/app/${app.id}`}
                  className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                  id={`app-link-${app.id}`}
                >
                  {app.name}
                </Link>
                <div className="text-slate-600 text-xs font-mono mt-0.5">{app.id}</div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-400">{app.targetUrl}</td>
              <td className="px-4 py-3 text-slate-300">{app._count?.routes ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                  app.isActive ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${app.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {app.isActive ? 'active' : 'inactive'}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500 text-xs">
                {new Date(app.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Service Catalog</h1>
          <p className="text-slate-400 text-sm mt-1">All registered Iris applications</p>
        </div>
        <CreateAppDialog />
      </div>
      <AppTable />
    </div>
  );
}
