'use client';

import { useEffect, useState } from 'react';

export default function AdminConsole() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data);
      });
  }, []);

  const approveUser = async (id: string) => {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'ACTIVE' })
    });
    setUsers(users.map(u => u.id === id ? { ...u, status: 'ACTIVE' } : u));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Admin Console: User Approvals</h1>
      <div className="bg-slate-900 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-800">
            <tr>
              <th className="p-4 font-semibold text-sm">Email</th>
              <th className="p-4 font-semibold text-sm">Role</th>
              <th className="p-4 font-semibold text-sm">Status</th>
              <th className="p-4 font-semibold text-sm">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map(u => (
              <tr key={u.id}>
                <td className="p-4 text-sm">{u.email}</td>
                <td className="p-4 text-sm">{u.role}</td>
                <td className="p-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs ${u.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-orange-500/20 text-orange-300'}`}>
                    {u.status}
                  </span>
                </td>
                <td className="p-4">
                  {u.status === 'PENDING' && (
                    <button 
                      onClick={() => approveUser(u.id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-md font-semibold"
                    >
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
