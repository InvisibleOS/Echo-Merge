import { NextResponse } from 'next/server';
import { getCases, getConstituencyHealth } from '../../../lib/server/action-os';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const constituency = searchParams.get('constituency') || 'Bengaluru South';
  const cases = getCases({ constituency });
  const health = getConstituencyHealth({ constituency });
  return NextResponse.json(
    {
      constituency,
      health_index: health.health_index,
      citizen_trust_score: health.citizen_trust_score,
      open_cases: health.open_cases,
      resolved_cases: cases.filter((item) => item.status === 'Resolved').length,
      public_cases: cases.slice(0, 20).map((item) => ({
        case_id: item.case_id,
        title: item.title,
        category: item.category,
        status: item.status,
        department: item.department.short_name,
        ward: item.ward,
      })),
    },
    { status: 200 }
  );
}

