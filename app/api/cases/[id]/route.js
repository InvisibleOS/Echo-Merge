import { NextResponse } from 'next/server';
import { updateCaseStatus } from '../../../../lib/server/action-os';

export const dynamic = 'force-dynamic';

export async function PATCH(request, context) {
  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === 'string' ? body.status : 'In Progress';
  const note = typeof body.note === 'string' ? body.note : '';
  const departmentId = typeof body.department_id === 'string' ? body.department_id : '';
  const params = await context.params;
  const updated = updateCaseStatus(params.id, status, note, departmentId);
  return NextResponse.json(updated, { status: updated ? 200 : 404 });
}
