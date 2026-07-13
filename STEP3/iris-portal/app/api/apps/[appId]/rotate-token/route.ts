import { NextRequest, NextResponse } from 'next/server';
import { irisCore } from '@/lib/iris-core-client';

interface Params { params: Promise<{ appId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { appId } = await params;
    const result = await irisCore.rotateToken(appId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
