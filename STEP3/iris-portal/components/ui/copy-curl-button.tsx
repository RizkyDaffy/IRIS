'use client';

import { useState } from 'react';

export function CopyCurlButton({ text, id }: { text: string; id: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      id={id}
      onClick={copy}
      className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
      aria-label="Copy curl command"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
