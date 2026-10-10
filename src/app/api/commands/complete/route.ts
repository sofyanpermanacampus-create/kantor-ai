import { NextRequest, NextResponse } from 'next/server';
import { setCommandStatus } from '@/lib/store';

// POST /api/commands/complete — complete_ceo_command: tandai "selesai" + ringkasan
// Body: { id: string, summary?: string }
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 });
  }
  const { id, summary } = (body as { id?: unknown; summary?: unknown }) ?? {};
  if (typeof id !== 'string' || id.length === 0) {
    return NextResponse.json({ error: 'Field "id" wajib diisi' }, { status: 400 });
  }
  if (summary !== undefined && typeof summary !== 'string') {
    return NextResponse.json({ error: 'Field "summary" harus string' }, { status: 400 });
  }
  const cmd = await setCommandStatus(id, 'selesai', summary);
  if (!cmd) return NextResponse.json({ error: 'Perintah tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ ok: true, command: cmd });
}
