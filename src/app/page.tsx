'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ActivitySnapshot, isSnapshotStale } from '@/lib/types';
import Hud from '@/components/Hud';
import AgentDirectory from '@/components/AgentDirectory';
import CommandPanel from '@/components/CommandPanel';
import ActivityLog from '@/components/ActivityLog';

// Scene 3D hanya dirender di client (Three.js butuh WebGL)
const OfficeScene = dynamic(() => import('@/components/OfficeScene'), { ssr: false });

const EMPTY: ActivitySnapshot = { agents: [], updated_at: new Date(0).toISOString() };

export default function Home() {
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | null>(null);
  const [live, setLive] = useState(false);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as ActivitySnapshot;
      setSnapshot(data);
      setLive(!isSnapshotStale(data));
    } catch {
      /* biarkan state terakhir; scene masuk mode ambient */
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    const t = setInterval(fetchActivity, 2000);
    return () => clearInterval(t);
  }, [fetchActivity]);

  return (
    <main className="kantor-root">
      <Hud live={live} agentCount={snapshot?.agents.length ?? 0} />
      <div className="kantor-body">
        <section className="kantor-scene">
          <OfficeScene snapshot={snapshot ?? EMPTY} live={live} />
          <div className="mode-badge" data-live={live}>
            {live ? '● LIVE' : '○ AMBIENT'}
          </div>
        </section>
        <aside className="kantor-side">
          <CommandPanel />
          <ActivityLog snapshot={snapshot ?? EMPTY} />
          <AgentDirectory snapshot={snapshot ?? EMPTY} />
        </aside>
      </div>
    </main>
  );
}
