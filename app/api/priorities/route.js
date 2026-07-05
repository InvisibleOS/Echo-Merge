import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'rank';
    const constituency = searchParams.get('constituency');

    const dbPath = path.join(process.cwd(), 'Data_Logic', 'local_db_backup.json');
    
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json([], { status: 200 });
    }

    const fileContent = fs.readFileSync(dbPath, 'utf-8');
    const db = JSON.parse(fileContent);
    let priorities = db.priorities || [];

    if (constituency) {
      priorities = priorities.filter(p => p.constituency === constituency);
    }

    if (sortBy === 'demand_score') {
      priorities.sort((a, b) => b.demand_score - a.demand_score);
    } else {
      priorities.sort((a, b) => (a.rank || 0) - (b.rank || 0));
    }

    // lib/api.ts expects an array returned directly, wait...
    // Let me check lib/api.ts for getPriorities
    // return safeFetch<PriorityItem[]>("/priorities");
    // If it expects an array directly, we must return the array, not { data: priorities }
    return NextResponse.json(priorities, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}
