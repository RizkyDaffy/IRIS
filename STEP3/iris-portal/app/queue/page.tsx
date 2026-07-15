'use client';

export default function QueuePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="w-20 h-20 bg-orange-50 border border-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 text-orange-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        
        <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Account in Queue</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          Your account is currently in the waiting list. A Super Admin must review and approve your registration before you can access the IRIS Portal.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Status</p>
          <p className="text-sm font-bold text-orange-600 flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
            </span>
            Waiting for approval
          </p>
        </div>
      </div>
    </div>
  );
}
