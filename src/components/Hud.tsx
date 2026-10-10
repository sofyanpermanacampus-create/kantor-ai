'use client';

import { useEffect, useState } from 'react';
import { AGENT_COUNT } from '@/lib/agents-data';

interface HudProps {
  live: boolean;
  agentCount: number;
}

/** Jam lokal WIB, HH:MM:SS */
function formatWIB(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export default function Hud({ live, agentCount }: HudProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="hud">
      <div className="hud-brand">
        <span className="hud-logo" aria-hidden="true">
          🏢
        </span>
        <div className="hud-brand-text">
          <h1 className="hud-title">Kantor AI</h1>
          <p className="hud-sub">Pusat kendali {AGENT_COUNT} agent AI</p>
        </div>
      </div>

      <div className="hud-stats">
        <div className="hud-clock" title="Waktu Indonesia Barat">
          <span className="hud-clock-time">{formatWIB(now)}</span>
          <span className="hud-clock-tz">WIB</span>
        </div>

        <span
          className={`badge ${live ? 'badge-live' : 'badge-ambient'}`}
          role="status"
          aria-label={live ? 'Mode live aktif' : 'Mode ambient, tidak ada feed live'}
        >
          {live ? '● LIVE' : '○ AMBIENT'}
        </span>

        <span className="hud-agents" aria-label={`${agentCount} agent aktif`}>
          <strong className="hud-agents-count">{agentCount}</strong>
          <span className="hud-agents-label">agent aktif</span>
        </span>
      </div>
    </header>
  );
}
