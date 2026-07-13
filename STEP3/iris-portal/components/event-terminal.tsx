'use client';

import { useEffect, useRef, useState } from 'react';
import type { OutboxEvent } from '@/lib/iris-core-client';

interface Props {
  appId: string;
}

// @rizkydaffy: poll every 5s — no SSE complexity needed for v1
const POLL_MS = 5_000;

export function EventTerminal({ appId }: Props) {
  const [events, setEvents] = useState<OutboxEvent[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'failed'>('all');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const qs = filter !== 'all' ? `?status=${filter}` : '';
        const res = await fetch(`/api/apps/${appId}/events${qs}`);
        if (!res.ok) return;
        const data: OutboxEvent[] = await res.json();
        if (!cancelled) setEvents(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [appId, filter]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const statusColor: Record<string, string> = {
    pending: 'text-amber-400',
    published: 'text-emerald-400',
    failed: 'text-red-400',
  };

  return (
    <div className="flex flex-col h-full" id={`event-terminal-${appId}`}>
      {/* Filters */}
      <div className="flex gap-1 mb-2">
        {(['all', 'pending', 'published', 'failed'] as const).map(s => (
          <button
            key={s}
            id={`event-filter-${s}`}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${filter === s
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Terminal */}
      <div className="flex-1 overflow-y-auto bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs space-y-1 min-h-0">
        {loading && <p className="text-slate-500">Loading…</p>}
        {!loading && events.length === 0 && (
          <p className="text-slate-600">No events yet.</p>
        )}
        {events.map(ev => (
          <div key={ev.id} className="flex gap-3 items-start py-0.5 border-b border-slate-900">
            <span className="text-slate-600 shrink-0 w-[160px]">
              {new Date(ev.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
            </span>
            <span className={`shrink-0 w-20 ${statusColor[ev.status] ?? 'text-slate-400'}`}>
              {ev.status}
            </span>
            <span className="text-violet-300 shrink-0">{ev.event}</span>
            <span className="text-slate-500 truncate">{ev.routingKey}</span>
            {ev.lastError && (
              <span className="text-red-400 truncate" title={ev.lastError}>
                ⚠ {ev.lastError.slice(0, 60)}
              </span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
