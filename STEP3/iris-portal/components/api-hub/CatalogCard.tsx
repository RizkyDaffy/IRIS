import { Logo } from "./Logo";

export interface CatalogItem {
  title: string;
  org: string;
  description: string;
  status: "Available" | "Deprecated";
  pricing: "Free" | "Paid";
}

export function CatalogCard({ item }: { item: CatalogItem }) {
  return (
    <article className="group rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-brand/40 hover:shadow-elevated">
      <div className="flex gap-5">
        <div className="flex h-[150px] w-[150px] shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background">
          <Logo size="sm" className="flex-col gap-1.5" />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="text-[17px] font-bold uppercase leading-tight tracking-tight text-foreground">
            {item.title}
          </h3>
          <p className="mt-1.5 text-[15px] font-semibold uppercase leading-tight text-foreground/85">
            {item.org}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-success/50 bg-transparent px-3 py-1 text-[13px] font-semibold text-success-foreground">
              {item.status}
            </span>
            <span className="inline-flex items-center rounded-md border border-success/50 bg-transparent px-3 py-1 text-[13px] font-semibold text-success-foreground">
              {item.pricing}
            </span>
          </div>
          <p className="mt-3 line-clamp-2 text-[14px] text-foreground/80">{item.description}</p>
        </div>
      </div>
    </article>
  );
}
