// Kontrak data bersama Kantor AI — dipakai frontend, API, dan scene 3D.

export type AgentStatus =
  | 'working'
  | 'reading'
  | 'running'
  | 'idle'
  | 'waiting'
  | 'done';

export const AGENT_STATUSES: AgentStatus[] = [
  'working',
  'reading',
  'running',
  'idle',
  'waiting',
  'done',
];

export interface LiveAgent {
  id: string; // cocok dengan AgencyAgent.id, atau id bebas untuk demo
  name: string;
  division: string; // nama divisi (cocok dengan Division.name) atau bebas
  status: AgentStatus;
  detail?: string; // deskripsi aktivitas saat ini
}

export interface ActivitySnapshot {
  agents: LiveAgent[];
  updated_at: string; // ISO-8601 UTC
}

/** true jika snapshot dianggap basi (tidak ada data live) */
export function isSnapshotStale(s: ActivitySnapshot | null, maxAgeMs = 15000): boolean {
  if (!s || !s.agents || s.agents.length === 0) return true;
  const t = Date.parse(s.updated_at);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > maxAgeMs;
}

export type CommandStatus = 'baru' | 'diproses' | 'selesai';

export interface CeoCommand {
  id: string;
  text: string;
  status: CommandStatus;
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
  summary?: string; // ringkasan hasil saat selesai
}

export const STATUS_LABEL_ID: Record<AgentStatus, string> = {
  working: 'Bekerja',
  reading: 'Membaca',
  running: 'Berlari',
  idle: 'Diam',
  waiting: 'Menunggu',
  done: 'Selesai',
};

export const STATUS_COLOR: Record<AgentStatus, string> = {
  working: '#4ade80',
  reading: '#60a5fa',
  running: '#fbbf24',
  idle: '#9ca3af',
  waiting: '#f472b6',
  done: '#a78bfa',
};
