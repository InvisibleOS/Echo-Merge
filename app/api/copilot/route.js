import { NextResponse } from 'next/server';
import { askCopilot } from '../../../lib/server/action-os';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const question = typeof body.question === 'string' ? body.question : '';
  const constituency = typeof body.constituency === 'string' ? body.constituency : 'Bengaluru South';
  return NextResponse.json(await askCopilot(question, { constituency }), { status: 200 });
}
