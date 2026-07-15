import { notFound } from 'next/navigation';
import { irisCore } from '@/lib/iris-core-client';
import { AppHeader } from '@/components/app-header';

export const dynamic = 'force-dynamic';

export default async function AppDetailLayout({ children, params }: { children: React.ReactNode, params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  let app;
  try {
    app = await irisCore.getApp(appId);
  } catch {
    notFound();
  }

  return <AppHeader app={app}>{children}</AppHeader>;
}
