import { NextResponse } from 'next/server';
import { getGovernanceInsights } from '../../../../lib/server/action-os';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const constituency = searchParams.get('constituency') || 'Bengaluru South';
  return NextResponse.json(getGovernanceInsights({ constituency }), { status: 200 });
}
