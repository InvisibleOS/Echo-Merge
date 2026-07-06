import { NextResponse } from 'next/server';
import { getCases } from '../../../../lib/server/action-os';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const department = searchParams.get('department') || '';
  const cases = getCases({
    constituency: searchParams.get('constituency') || '',
    status: searchParams.get('status') || '',
  }).filter((item) => (department ? item.department.id === department : true));
  return NextResponse.json(cases, { status: 200 });
}
