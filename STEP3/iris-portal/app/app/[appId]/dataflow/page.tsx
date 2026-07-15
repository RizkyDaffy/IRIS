'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

const mockData = [
  { time: '10:00', dataIn: 12, dataOut: 45 },
  { time: '10:05', dataIn: 18, dataOut: 52 },
  { time: '10:10', dataIn: 45, dataOut: 105 },
  { time: '10:15', dataIn: 80, dataOut: 220 },
  { time: '10:20', dataIn: 65, dataOut: 150 },
  { time: '10:25', dataIn: 30, dataOut: 65 },
  { time: '10:30', dataIn: 15, dataOut: 42 },
];

export default function DataFlowPage({ params }: { params: { appId: string } }) {
  const { appId } = params;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500 mb-4">
        <Link href={`/app/${appId}`} className="hover:text-slate-300 transition-colors">App Overview</Link>
        <span className="mx-2">/</span>
        <span className="text-white">Data Flow</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Data Flow Topology</h1>
        <p className="text-slate-400 mt-1">Live data egress and ingress metrics for this target URL.</p>
      </div>

      <Card className="bg-slate-900 border-slate-800 p-6">
        <h2 className="text-lg font-bold text-white mb-6">Bandwidth (MB/s)</h2>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Line type="monotone" dataKey="dataIn" stroke="#3b82f6" strokeWidth={3} dot={false} name="Ingress" />
              <Line type="monotone" dataKey="dataOut" stroke="#10b981" strokeWidth={3} dot={false} name="Egress" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
