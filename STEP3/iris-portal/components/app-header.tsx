'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppHeader({ app, children }: { app: any, children?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Back
        </Link>
        <div className="text-sm text-gray-500 flex items-center gap-2 font-medium">
          <Link href="/" className="hover:text-gray-900">Home</Link>
          <span>&gt;</span>
          <Link href="/" className="hover:text-gray-900">API Catalog</Link>
          <span>&gt;</span>
          <span className="text-gray-900 font-bold uppercase">{app.name}</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-gray-200">
        <div className="flex gap-6 items-center">
          <div className="w-40 h-40 flex-shrink-0 border border-gray-200 rounded-xl flex flex-col items-center justify-center bg-white shadow-sm p-4">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-red-600 mb-2">
              <path d="M12 2L15 8L21 9L16 14L18 20L12 17L6 20L8 14L3 9L9 8L12 2Z" fill="currentColor" />
            </svg>
            <div className="flex flex-col items-center leading-none">
              <span className="text-red-600 font-bold text-xl">IRIS</span>
              <span className="text-gray-900 font-bold text-sm">API Hub</span>
            </div>
          </div>

          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900 uppercase mb-2">{app.name}</h1>
            <p className="text-gray-600 mb-3 font-medium">by : {app.targetUrl.split('/').pop() || 'Iris'}</p>
            <p className="text-sm text-gray-500 mb-4 font-medium">
              Version 0.0.1 <span className="mx-1 text-gray-300">|</span> <span className="font-bold text-gray-700">{app.isActive ? 'Active' : 'Inactive'}</span>
            </p>
            <div className="flex gap-2">
              <span className={`px-4 py-1.5 rounded-lg border text-sm font-semibold ${app.isActive ? 'border-green-300 text-green-700 bg-white' : 'border-red-300 text-red-700 bg-white'}`}>
                {app.isActive ? 'Available' : 'Inactive'}
              </span>
              <span className="px-4 py-1.5 rounded-lg border border-green-300 text-green-700 bg-white text-sm font-semibold">
                Free
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 w-full lg:w-auto">
          <div className="w-full lg:w-64">
            <div className="text-sm font-semibold text-gray-900 mb-2 text-right">Select Organization</div>
            <select className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-gray-700 bg-white">
              <option>Personal Account</option>
            </select>
          </div>
          <button className="w-full lg:w-64 py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors mt-2">
            INTEGRATE NOW
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-2 p-8 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Description</h2>
        <p className="text-gray-600 mb-8">
          Get Data {app.name} by {app.targetUrl.split('/').pop() || 'Iris'} Web Service
        </p>

        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
            <Link
              href={`/app/${app.id}/docs`}
              className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-colors ${pathname.includes('/docs') ? 'bg-red-500 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}
            >
              Endpoint
            </Link>
            <Link
              href={`/app/${app.id}`}
              className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-colors ${!pathname.includes('/docs') && !pathname.includes('/events') ? 'bg-red-500 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}
            >
              Documentation
            </Link>
            <button className="px-8 py-2.5 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors cursor-not-allowed opacity-50">
              Pricing
            </button>
          </div>
        </div>

        <div className="border-t border-gray-200 mb-8 -mx-8 px-8" />

        <div id="tab-content-area">
          {children}
        </div>
      </div>
    </div>
  );
}
