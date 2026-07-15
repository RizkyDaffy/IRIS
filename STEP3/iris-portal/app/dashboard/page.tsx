'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockData = [
  { time: '00:00', requests: 120, errors: 2, latency: 45 },
  { time: '04:00', requests: 180, errors: 5, latency: 52 },
  { time: '08:00', requests: 450, errors: 12, latency: 105 },
  { time: '12:00', requests: 800, errors: 45, latency: 220 },
  { time: '16:00', requests: 650, errors: 18, latency: 150 },
  { time: '20:00', requests: 300, errors: 4, latency: 65 },
  { time: '24:00', requests: 150, errors: 1, latency: 42 },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">System Dashboard</h1>
        <p className="text-slate-400 mt-1">High-level telemetry and active gateway metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400 font-medium">Total Requests (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">2.4M</div>
            <p className="text-xs text-emerald-400 mt-1">+14% from yesterday</p>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400 font-medium">Average Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">112ms</div>
            <p className="text-xs text-orange-400 mt-1">p99: 450ms</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400 font-medium">Error Rate (5xx)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0.04%</div>
            <p className="text-xs text-emerald-400 mt-1">Healthy</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800 p-6">
        <h2 className="text-lg font-bold text-white mb-6">Global Request Flow</h2>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData}>
              <defs>
                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="requests" stroke="#dc2626" strokeWidth={2} fillOpacity={1} fill="url(#colorRequests)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
