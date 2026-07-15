'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function AppSidebar({ user }: { user: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const initial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
  const roleDisplay = user?.role === 'SUPER_ADMIN' ? 'Super Admin' : user?.role === 'ADMIN' ? 'Admin' : 'Developer';

  return (
    <>
      {/* Hamburger Trigger */}
      <button 
        aria-label="Open menu" 
        onClick={() => setIsOpen(true)}
        className="grid h-11 w-11 place-items-center rounded-full text-gray-900 hover:bg-gray-100 transition lg:hidden" 
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu h-6 w-6" aria-hidden="true">
          <path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path>
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <div 
        role="dialog" 
        data-state={isOpen ? "open" : "closed"} 
        className={`fixed z-50 gap-4 bg-white shadow-lg transition-transform ease-in-out duration-300 inset-y-0 left-0 h-full border-r sm:max-w-sm w-[300px] p-0 sm:w-[340px] flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
              <g fill="none" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="20" cy="20" r="4.5" fill="#dc2626"></circle>
                <circle cx="8" cy="10" r="2.8"></circle>
                <circle cx="32" cy="10" r="2.8"></circle>
                <circle cx="8" cy="30" r="2.8"></circle>
                <circle cx="32" cy="30" r="2.8"></circle>
                <path d="M10.2 11.6 17 18M29.8 11.6 23 18M10.2 28.4 17 22M29.8 28.4 23 22"></path>
              </g>
            </svg>
            <div className="leading-none">
              <div className="text-base font-extrabold text-red-600 tracking-tight">Enterprise</div>
              <div className="text-[10px] font-semibold text-gray-900/80 tracking-wide">API Hub</div>
            </div>
          </Link>
          <button aria-label="Close" onClick={() => setIsOpen(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-gray-100 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x h-4 w-4" aria-hidden="true">
              <path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">Menu</div>
          <ul className="space-y-1">
            <li>
              <Link href="/" className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold text-gray-900/85 transition hover:bg-red-50 hover:text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-house h-[18px] w-[18px]" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                Home
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold text-gray-900/85 transition hover:bg-red-50 hover:text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-activity h-[18px] w-[18px]" aria-hidden="true"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.48 12H2"></path></svg>
                System Dashboard
              </Link>
            </li>
            <li>
              <Link href="/" className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold text-gray-900/85 transition hover:bg-red-50 hover:text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building2 lucide-building-2 h-[18px] w-[18px]" aria-hidden="true"><path d="M10 12h4"></path><path d="M10 8h4"></path><path d="M14 21v-3a2 2 0 0 0-4 0v3"></path><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path></svg>
                My Orgs
              </Link>
            </li>
            <li>
              <Link href="/" className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold text-gray-900/85 transition hover:bg-red-50 hover:text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layout-grid h-[18px] w-[18px]" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="14" rx="1"></rect><rect width="7" height="7" x="3" y="14" rx="1"></rect></svg>
                API Catalog
              </Link>
            </li>
            {user?.role === 'SUPER_ADMIN' && (
              <li>
                <Link href="/admin" className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold text-gray-900/85 transition hover:bg-red-50 hover:text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-check h-[18px] w-[18px]" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>
                  Admin Console
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {user && (
          <div className="border-t border-gray-200 p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-600 text-sm font-bold text-white shadow-inner">
                  {initial}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-gray-900">{roleDisplay}</div>
                  <div className="truncate text-xs text-gray-500">{user.email}</div>
                </div>
              </div>
              <button onClick={handleLogout} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-gray-700 h-9 px-4 py-2 w-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-out mr-2 h-4 w-4" aria-hidden="true"><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path></svg> 
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
