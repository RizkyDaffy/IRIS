"use client";

import { Search, LogOut, User as UserIcon, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { Logo } from "./Logo";
import { AppSidebarTrigger } from "./AppSidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

export function Header({ user }: { user?: any }) {
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto grid h-20 max-w-[1400px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:h-24 sm:px-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <AppSidebarTrigger user={user} />
          <Link href="/" className="flex items-center"><Logo size="sm" /></Link>
        </div>

        <div className="flex justify-end">
          <button aria-label="Search"
            className="hidden h-11 w-11 place-items-center rounded-full text-foreground hover:bg-muted transition sm:grid">
            <Search className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-full border border-border/70 bg-card p-1 pr-4 transition hover:border-brand/40 hover:shadow-sm">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-brand/70 text-sm font-bold text-white">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden text-left leading-tight sm:block">
                    <div className="text-[13px] font-bold text-foreground">{user.role}</div>
                    <div className="text-[11px] text-muted-foreground">{user.email}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="text-sm font-bold">{user.email}</div>
                  <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
                  <div className="mt-1 inline-flex items-center rounded-md border border-brand/40 bg-brand/5 px-2 py-0.5 text-[10px] font-bold uppercase text-brand">
                    {user.status}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/"><UserIcon className="mr-2 h-4 w-4" />Profile</Link>
                </DropdownMenuItem>
                {user.role === "SUPER_ADMIN" && (
                  <DropdownMenuItem asChild>
                    <Link href={"/admin" as any}><LayoutDashboard className="mr-2 h-4 w-4" />Admin Console</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href={"/daftar" as any}
                className="hidden h-11 items-center rounded-md bg-[#6b6b6b] px-5 text-[13px] font-bold tracking-wide text-white hover:bg-[#5a5a5a] transition sm:inline-flex sm:h-12 sm:px-8 sm:text-[15px]">
                REGISTER
              </Link>
              <Link href={"/login" as any}
                className="inline-flex h-11 items-center rounded-md bg-[#0a0a0a] px-5 text-[13px] font-bold tracking-wide text-white hover:bg-black transition sm:h-12 sm:px-9 sm:text-[15px]">
                LOGIN
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
