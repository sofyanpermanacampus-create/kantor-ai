import { NextRequest, NextResponse } from 'next/server';
import { listCommands, createCommand } from '@/lib/store';

// GET /api/commands — get_ceo_commands (semua perintah, terbaru dulu)
export async function GET() {
  const cmds = await listCommands();
  return NextResponse.json({ commands: cmds });
}

// POST /api/commands — buat perintah baru dari panel "Perintah ke Noir"
// Body: { text: string }
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 });
  }
  const text = (body as { text?: unknown })?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'Field "text" wajib diisi' }, { status: 400 });
  }
  const cmd = await createCommand(text);
  return NextResponse.json({ ok: true, command: cmd }, { status: 201 });
}
