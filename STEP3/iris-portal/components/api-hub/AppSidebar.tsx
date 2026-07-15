"use client";

import Link from "next/link";
import { Menu, Home, Building2, LayoutGrid, ShieldCheck, LogIn, UserPlus, LogOut, X } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "./Logo";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

export function AppSidebarTrigger({ user }: { user?: any }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isAdmin = user?.role === "SUPER_ADMIN";

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const items: NavItem[] = [
    { to: "/", label: "Home", icon: Home },
    { to: "/", label: "My Orgs", icon: Building2 },
    { to: "/", label: "API Catalog", icon: LayoutGrid },
  ];
  if (isAdmin) items.push({ to: "/admin", label: "Admin Console", icon: ShieldCheck });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button aria-label="Open menu"
          className="grid h-11 w-11 place-items-center rounded-full text-foreground hover:bg-muted transition">
          <Menu className="h-6 w-6" strokeWidth={2.2} />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] p-0 sm:w-[340px]">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border/70 px-6 py-5">
            <Logo size="sm" />
            <button onClick={() => setOpen(false)} aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Menu</div>
            <ul className="space-y-1">
              {items.map((it, idx) => (
                <li key={idx}>
                  <Link href={it.to as any} onClick={() => setOpen(false)}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold text-foreground/85 transition hover:bg-brand/8 hover:text-brand">
                    <it.icon className="h-[18px] w-[18px]" />
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-border/70 p-4">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{user.role}</div>
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={() => { logout(); setOpen(false); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href={"/login" as any} onClick={() => setOpen(false)}
                  className="grid h-11 place-items-center rounded-md bg-[#0a0a0a] text-sm font-bold text-white hover:bg-black">
                  <span className="inline-flex items-center gap-1.5"><LogIn className="h-4 w-4" />LOGIN</span>
                </Link>
                <Link href={"/daftar" as any} onClick={() => setOpen(false)}
                  className="grid h-11 place-items-center rounded-md bg-brand text-sm font-bold text-white hover:opacity-90">
                  <span className="inline-flex items-center gap-1.5"><UserPlus className="h-4 w-4" />REGISTER</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
