import { NextRequest, NextResponse } from 'next/server';
import { irisCore } from '@/lib/iris-core-client';

interface Params { params: Promise<{ appId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { appId } = await params;
    const url = new URL(req.url);
    const events = await irisCore.getEvents(appId, {
      status: url.searchParams.get('status') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: url.searchParams.has('limit') ? parseInt(url.searchParams.get('limit')!) : 100,
    });
    return NextResponse.json(events);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
