// Store in-memory + persistensi file JSON sederhana untuk activity & perintah CEO.
// Catatan: di Vercel (serverless) state in-memory tidak persisten antar invocasi;
// file di ./data juga ephemeral. Untuk demo ini cukup; produksi butuh KV/DB.

import { promises as fs } from 'fs';
import path from 'path';
import { ActivitySnapshot, CeoCommand, CommandStatus } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf-8');
}

// ---------- Activity snapshot ----------
let activityCache: ActivitySnapshot | null = null;

export async function getActivity(): Promise<ActivitySnapshot | null> {
  if (activityCache) return activityCache;
  const fromFile = await readJson<ActivitySnapshot | null>('activity.json', null);
  activityCache = fromFile;
  return activityCache;
}

export async function setActivity(s: ActivitySnapshot): Promise<void> {
  activityCache = s;
  await writeJson('activity.json', s);
}

// ---------- CEO commands ----------
let commandsCache: CeoCommand[] | null = null;

async function loadCommands(): Promise<CeoCommand[]> {
  if (commandsCache) return commandsCache;
  commandsCache = await readJson<CeoCommand[]>('commands.json', []);
  return commandsCache;
}

async function saveCommands(cmds: CeoCommand[]): Promise<void> {
  commandsCache = cmds;
  await writeJson('commands.json', cmds);
}

function nowIso(): string {
  return new Date().toISOString();
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listCommands(): Promise<CeoCommand[]> {
  const cmds = await loadCommands();
  return [...cmds].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createCommand(text: string): Promise<CeoCommand> {
  const cmds = await loadCommands();
  const cmd: CeoCommand = {
    id: uid(),
    text: text.trim(),
    status: 'baru',
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  cmds.push(cmd);
  await saveCommands(cmds);
  return cmd;
}

export async function setCommandStatus(
  id: string,
  status: CommandStatus,
  summary?: string
): Promise<CeoCommand | null> {
  const cmds = await loadCommands();
  const cmd = cmds.find((c) => c.id === id);
  if (!cmd) return null;
  cmd.status = status;
  cmd.updated_at = nowIso();
  if (summary !== undefined) cmd.summary = summary;
  await saveCommands(cmds);
  return cmd;
}
