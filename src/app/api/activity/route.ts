import { NextRequest, NextResponse } from 'next/server';
import { getActivity, setActivity } from '@/lib/store';
import { ActivitySnapshot, AGENT_STATUSES } from '@/lib/types';

// GET /api/activity — snapshot live terakhir (dipoll frontend tiap 2 detik)
export async function GET() {
  const snap = await getActivity();
  return NextResponse.json(snap ?? { agents: [], updated_at: new Date(0).toISOString() });
}

// POST /api/activity — report_agent_activity
// Body: { agents: [{id, name, division, status, detail?}], updated_at: ISO-8601 UTC }
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 });
  }
  const b = body as Partial<ActivitySnapshot>;
  if (!b || !Array.isArray(b.agents)) {
    return NextResponse.json({ error: 'Field "agents" (array) wajib ada' }, { status: 400 });
  }
  for (const a of b.agents) {
    if (!a || typeof a.id !== 'string' || typeof a.name !== 'string') {
      return NextResponse.json({ error: 'Setiap agent wajib punya id dan name (string)' }, { status: 400 });
    }
    if (!AGENT_STATUSES.includes(a.status)) {
      return NextResponse.json(
        { error: `Status "${a.status}" tidak valid. Pilihan: ${AGENT_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }
  }
  const snap: ActivitySnapshot = {
    agents: b.agents.map((a) => ({
      id: a.id,
      name: a.name,
      division: typeof a.division === 'string' ? a.division : '',
      status: a.status,
      detail: typeof a.detail === 'string' ? a.detail : undefined,
    })),
    updated_at: typeof b.updated_at === 'string' ? b.updated_at : new Date().toISOString(),
  };
  await setActivity(snap);
  return NextResponse.json({ ok: true, count: snap.agents.length });
}
