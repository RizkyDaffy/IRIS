import { NextRequest, NextResponse } from 'next/server';
import { irisCore } from '@/lib/iris-core-client';

interface Params { params: Promise<{ appId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { appId } = await params;
    const app = await irisCore.getApp(appId);
    return NextResponse.json(app);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { appId } = await params;
    const body = await req.json();
    const app = await irisCore.patchApp(appId, body);
    return NextResponse.json(app);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
