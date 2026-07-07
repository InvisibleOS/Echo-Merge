import { NextResponse } from 'next/server';
import { getCases } from '../../../lib/server/action-os';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json(
    getCases({
      status: searchParams.get('status') || '',
    }),
    { status: 200 }
  );
}
