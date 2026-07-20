// §3.3 View B (app overview) — /app/[appId]
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { irisCore, ApiError } from '@/lib/iris-core-client';
import { TokenRotateDialog } from '@/components/token-rotate-dialog';

export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ appId: string }> }

export async function generateMetadata({ params }: Props) {
  const { appId } = await params;
  return { title: `Iris Portal — ${appId}` };
}

export default async function AppOverviewPage({ params }: Props) {
  const { appId } = await params;
  let app;
  try {
    app = await irisCore.getApp(appId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500 mb-4">
        <Link href="/" className="hover:text-slate-300 transition-colors">Catalog</Link>
        <span className="mx-2">/</span>
        <span className="text-white">{app.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{app.name}</h1>
          <p className="text-slate-500 font-mono text-xs mt-1">{app.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            app.isActive
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${app.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {app.isActive ? 'active' : 'inactive'}
          </span>
          <TokenRotateDialog appId={appId} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Routes', value: app.routes.length },
          { label: 'Events (total)', value: app._count.outboxItems },
          { label: 'Last sync', value: app.routeSyncs[0]?.syncedAt
            ? new Date(app.routeSyncs[0].syncedAt).toLocaleString()
            : 'Never' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{stat.label}</p>
            <p className="text-white font-bold text-xl">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Target */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <p className="text-slate-500 text-xs mb-1">Target URL</p>
        <p className="font-mono text-sm text-slate-200">{app.targetUrl}</p>
      </div>

      {/* Nav */}
      <div className="flex gap-2">
        <Link
          href={`/app/${appId}/docs`}
          id={`app-docs-link-${appId}`}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
        >
          API Docs
        </Link>
        <Link
          href={`/app/${appId}/events`}
          id={`app-events-link-${appId}`}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
        >
          Event Log
        </Link>
      </div>
    </div>
  );
}
