import { notFound } from 'next/navigation';

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 text-center">
      <h1 className="text-4xl font-bold text-slate-600 mb-2">404</h1>
      <p className="text-slate-400">Application not found or has been deactivated.</p>
    </div>
  );
}
