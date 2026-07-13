'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateAppDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      setToken(data.token);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setToken(null);
    setName('');
    setTargetUrl('');
    setError(null);
  }

  return (
    <>
      <button
        id="create-app-btn"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
      >
        + New Application
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            {token ? (
              // Token reveal — shown exactly once (§0.1)
              <div>
                <h2 className="text-lg font-bold text-white mb-2">Application Created</h2>
                <p className="text-amber-400 text-sm mb-3">
                  ⚠ Copy this token now — it will never be shown again.
                </p>
                <div
                  id="token-reveal"
                  className="bg-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-300 break-all select-all border border-slate-600"
                >
                  {token}
                </div>
                <button
                  id="token-copy-btn"
                  className="mt-3 w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
                  onClick={() => navigator.clipboard.writeText(token)}
                >
                  Copy to clipboard
                </button>
                <button
                  id="token-done-btn"
                  className="mt-2 w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
                  onClick={close}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h2 className="text-lg font-bold text-white mb-4">New Application</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1" htmlFor="app-name">Name</label>
                    <input
                      id="app-name"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="my-service"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1" htmlFor="app-target">Target URL</label>
                    <input
                      id="app-target"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                      value={targetUrl}
                      onChange={e => setTargetUrl(e.target.value)}
                      placeholder="http://localhost:3001"
                      required
                      type="url"
                    />
                  </div>
                </div>
                {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="create-app-submit"
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                  >
                    {loading ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
