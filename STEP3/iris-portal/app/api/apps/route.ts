// Portal API proxy → iris-core admin API
// §0.3 — portal client calls portal /api/apps, portal calls iris-core on the server side
import { NextRequest, NextResponse } from 'next/server';
import { irisCore } from '@/lib/iris-core-client';

export async function GET() {
  try {
    const apps = await irisCore.listApps();
    return NextResponse.json(apps);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const app = await irisCore.createApp(body);
    return NextResponse.json(app, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
