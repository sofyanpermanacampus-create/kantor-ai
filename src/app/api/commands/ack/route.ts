import { NextRequest, NextResponse } from 'next/server';
import { setCommandStatus } from '@/lib/store';

// POST /api/commands/ack — ack_ceo_command: tandai perintah sebagai "diproses"
// Body: { id: string }
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 });
  }
  const id = (body as { id?: unknown })?.id;
  if (typeof id !== 'string' || id.length === 0) {
    return NextResponse.json({ error: 'Field "id" wajib diisi' }, { status: 400 });
  }
  const cmd = await setCommandStatus(id, 'diproses');
  if (!cmd) return NextResponse.json({ error: 'Perintah tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ ok: true, command: cmd });
}
