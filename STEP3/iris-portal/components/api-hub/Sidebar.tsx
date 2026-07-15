import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const categories = ["Data"];
const tags = ["Database", "Big Data"];
const pricing = ["Free", "Paid"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h4 className="mb-3 text-[15px] font-semibold text-foreground">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Item({ id, label }: { id: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox id={id} className="h-5 w-5 rounded-sm border-[1.5px] border-foreground/40 data-[state=checked]:bg-brand data-[state=checked]:border-brand" />
      <Label htmlFor={id} className="text-[15px] font-normal text-foreground cursor-pointer">{label}</Label>
    </div>
  );
}

export function FiltersSidebar() {
  return (
    <aside className="w-full shrink-0 lg:w-[260px]">
      <div className="rounded-2xl border border-border/70 bg-card p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <label className="mb-3 block text-[16px] font-medium text-foreground">Organization</label>
        <button className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-[15px] font-normal text-foreground hover:bg-muted/50 transition">
          Personal Account
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="my-6 h-px w-full bg-border" />

        <h3 className="text-[17px] font-bold text-foreground">Filters</h3>
        <Section title="Categories">
          {categories.map((c) => <Item key={c} id={`cat-${c}`} label={c} />)}
        </Section>
        <Section title="Tags">
          {tags.map((t) => <Item key={t} id={`tag-${t}`} label={t} />)}
        </Section>
        <Section title="Pricing">
          {pricing.map((p) => <Item key={p} id={`price-${p}`} label={p} />)}
        </Section>
      </div>
    </aside>
  );
}
