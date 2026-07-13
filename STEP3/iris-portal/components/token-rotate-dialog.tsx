'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  appId: string;
}

export function TokenRotateDialog({ appId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRotate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/rotate-token`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
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
    setError(null);
  }

  return (
    <>
      <button
        id={`rotate-token-btn-${appId}`}
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 text-xs font-semibold transition-colors border border-amber-600/30"
      >
        Rotate Token
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            {token ? (
              <div>
                <h2 className="text-lg font-bold text-white mb-2">New Token</h2>
                <p className="text-amber-400 text-sm mb-3">
                  ⚠ Your previous token is now invalid. Copy this now — it will never be shown again.
                </p>
                <div
                  id={`rotated-token-${appId}`}
                  className="bg-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-300 break-all select-all border border-slate-600"
                >
                  {token}
                </div>
                <button
                  className="mt-3 w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
                  onClick={() => navigator.clipboard.writeText(token)}
                >
                  Copy to clipboard
                </button>
                <button
                  className="mt-2 w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
                  onClick={close}
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold text-white mb-2">Rotate Token</h2>
                <p className="text-slate-400 text-sm mb-4">
                  This will immediately invalidate the current token. Make sure to update your application.
                </p>
                {error && <p className="mb-3 text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={close}
                    className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id={`rotate-confirm-${appId}`}
                    onClick={handleRotate}
                    disabled={loading}
                    className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                  >
                    {loading ? 'Rotating…' : 'Rotate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
