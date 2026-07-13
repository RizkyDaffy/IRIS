// §3.3 View C — Event Log /app/[appId]/events
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { irisCore } from '@/lib/iris-core-client';
import { EventTerminal } from '@/components/event-terminal';

export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ appId: string }> }

export async function generateMetadata({ params }: Props) {
  return { title: 'Iris Portal — Event Log' };
}

export default async function EventsPage({ params }: Props) {
  const { appId } = await params;

  // Just verify the app exists
  try {
    await irisCore.getApp(appId);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <nav className="text-sm text-slate-500 mb-4">
        <Link href="/" className="hover:text-slate-300 transition-colors">Catalog</Link>
        <span className="mx-2">/</span>
        <Link href={`/app/${appId}`} className="hover:text-slate-300 transition-colors">{appId}</Link>
        <span className="mx-2">/</span>
        <span className="text-white">Events</span>
      </nav>

      <h1 className="text-2xl font-bold text-white mb-4">Event Log</h1>

      {/* Client component handles polling */}
      <EventTerminal appId={appId} />
    </div>
  );
}
