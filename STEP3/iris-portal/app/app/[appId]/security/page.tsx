'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

const mockSecurityData = [
  { day: 'Mon', unauthorized: 12, ratelimit: 5 },
  { day: 'Tue', unauthorized: 8, ratelimit: 2 },
  { day: 'Wed', unauthorized: 45, ratelimit: 120 }, // Anomaly
  { day: 'Thu', unauthorized: 15, ratelimit: 8 },
  { day: 'Fri', unauthorized: 10, ratelimit: 4 },
  { day: 'Sat', unauthorized: 5, ratelimit: 1 },
  { day: 'Sun', unauthorized: 3, ratelimit: 0 },
];

export default function SecurityPage({ params }: { params: { appId: string } }) {
  const { appId } = params;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500 mb-4">
        <Link href={`/app/${appId}`} className="hover:text-slate-300 transition-colors">App Overview</Link>
        <span className="mx-2">/</span>
        <span className="text-white">Security & Anomalies</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Security Analytics</h1>
        <p className="text-slate-400 mt-1">Track 401 Unauthorized and 429 Rate Limit triggers.</p>
      </div>

      <Card className="bg-slate-900 border-slate-800 p-6">
        <h2 className="text-lg font-bold text-white mb-6">Access Denials (Last 7 Days)</h2>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockSecurityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                itemStyle={{ color: '#e2e8f0' }}
                cursor={{ fill: '#1e293b' }}
              />
              <Bar dataKey="unauthorized" name="401 Unauthorized" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ratelimit" name="429 Rate Limited" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
