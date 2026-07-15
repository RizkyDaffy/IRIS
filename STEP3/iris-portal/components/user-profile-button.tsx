'use client';

import { useRouter } from 'next/navigation';

export function UserProfileButton({ user }: { user: any }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  if (!user) return null;

  const initial = user.email ? user.email.charAt(0).toUpperCase() : 'U';
  const roleDisplay = user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role === 'ADMIN' ? 'Admin' : 'Developer';

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <button 
        onClick={handleLogout}
        title="Click to logout"
        className="flex items-center gap-3 rounded-full border border-gray-200 bg-white p-1 pr-4 transition hover:border-red-300 hover:shadow-sm" 
        type="button"
      >
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-red-600 to-red-500 text-sm font-bold text-white shadow-inner">
          {initial}
        </div>
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-[13px] font-bold text-gray-900">{roleDisplay}</div>
          <div className="text-[11px] text-gray-500 truncate max-w-[120px]">{user.email}</div>
        </div>
      </button>
    </div>
  );
}
