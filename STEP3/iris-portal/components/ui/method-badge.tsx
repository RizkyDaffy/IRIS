// Method badge colors — color + text label (§3.3 View B accessibility requirement)
const METHOD_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  GET:    { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'GET'    },
  POST:   { bg: 'bg-blue-500/20',    text: 'text-blue-300',    label: 'POST'   },
  PUT:    { bg: 'bg-amber-500/20',   text: 'text-amber-300',   label: 'PUT'    },
  PATCH:  { bg: 'bg-orange-500/20',  text: 'text-orange-300',  label: 'PATCH'  },
  DELETE: { bg: 'bg-red-500/20',     text: 'text-red-300',     label: 'DELETE' },
  HEAD:   { bg: 'bg-purple-500/20',  text: 'text-purple-300',  label: 'HEAD'   },
};

export function MethodBadge({ method }: { method: string }) {
  const cfg = METHOD_CONFIG[method.toUpperCase()] ?? {
    bg: 'bg-slate-500/20', text: 'text-slate-300', label: method.toUpperCase()
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${cfg.bg} ${cfg.text}`}
      aria-label={`HTTP method: ${cfg.label}`}
    >
      {cfg.label}
    </span>
  );
}
