import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "./Logo";

export function AuthShell({
  title, subtitle, children, footer,
}: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-brand/12 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-brand/6 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_0)] [background-size:22px_22px]" />
      </div>

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/"><Logo size="sm" /></Link>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col px-5 pb-16 pt-4">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] sm:p-8">
          {children}
        </div>
        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      </main>
    </div>
  );
}
