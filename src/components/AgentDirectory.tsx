'use client';

import { useEffect, useMemo, useState } from 'react';
import { ALL_AGENTS, DIVISIONS } from '@/lib/agents-data';
import type { ActivitySnapshot } from '@/lib/types';
import { STATUS_COLOR, STATUS_LABEL_ID } from '@/lib/types';

interface AgentDirectoryProps {
  snapshot: ActivitySnapshot;
}

const WARNA_OFFLINE = '#4b5573';
const BARIS_PER_HALAMAN = 40;

export default function AgentDirectory({ snapshot }: AgentDirectoryProps) {
  const [pencarian, setPencarian] = useState('');
  const [divisi, setDivisi] = useState<string>('semua');
  const [tampil, setTampil] = useState(BARIS_PER_HALAMAN);

  // Reset pagination setiap filter berubah
  useEffect(() => {
    setTampil(BARIS_PER_HALAMAN);
  }, [pencarian, divisi]);

  const liveById = useMemo(
    () => new Map(snapshot.agents.map((a) => [a.id, a])),
    [snapshot.agents],
  );

  const hasil = useMemo(() => {
    const q = pencarian.trim().toLowerCase();
    return ALL_AGENTS.filter((a) => {
      if (divisi !== 'semua' && a.divisionSlug !== divisi) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
      );
    });
  }, [pencarian, divisi]);

  const jumlahOnline = useMemo(
    () => hasil.reduce((n, a) => n + (liveById.has(a.id) ? 1 : 0), 0),
    [hasil, liveById],
  );

  const baris = hasil.slice(0, tampil);
  const sisa = hasil.length - baris.length;

  return (
    <section className="panel" aria-labelledby="judul-direktori">
      <div className="panel-header">
        <h2 id="judul-direktori" className="panel-title">
          Direktori Agent
        </h2>
        <span className="badge badge-info">{ALL_AGENTS.length} agent</span>
      </div>

      <div className="directory-filters">
        <label className="sr-only" htmlFor="cari-agent">
          Cari agent
        </label>
        <input
          id="cari-agent"
          type="search"
          className="input"
          placeholder="Cari nama atau kata kunci…"
          value={pencarian}
          onChange={(e) => setPencarian(e.target.value)}
          autoComplete="off"
        />
        <label className="sr-only" htmlFor="filter-divisi">
          Filter divisi
        </label>
        <select
          id="filter-divisi"
          className="input directory-select"
          value={divisi}
          onChange={(e) => setDivisi(e.target.value)}
        >
          <option value="semua">Semua divisi</option>
          {DIVISIONS.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <p className="panel-meta" role="status">
        Menampilkan {baris.length} dari {hasil.length} agent
        {liveById.size > 0
          ? ` · ${jumlahOnline} sedang live`
          : ' · tidak ada yang live (semua offline)'}
      </p>

      {hasil.length === 0 ? (
        <p className="empty-state">
          Tidak ada agent yang cocok dengan pencarianmu.
        </p>
      ) : (
        <>
          <ul className="agent-list">
            {baris.map((a) => {
              const live = liveById.get(a.id);
              const warna = live ? STATUS_COLOR[live.status] : WARNA_OFFLINE;
              const statusTeks = live ? STATUS_LABEL_ID[live.status] : 'Offline';
              return (
                <li
                  key={a.id}
                  className="agent-row"
                  title={a.description}
                >
                  <span
                    className="status-dot"
                    style={{ backgroundColor: warna }}
                    aria-hidden="true"
                  />
                  <div className="agent-row-body">
                    <span className="agent-row-name">{a.name}</span>
                    <span className="agent-row-meta">
                      {a.division} ·{' '}
                      <span style={{ color: warna }}>{statusTeks}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {sisa > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => setTampil((t) => t + BARIS_PER_HALAMAN)}
            >
              Muat {Math.min(sisa, BARIS_PER_HALAMAN)} lagi ({sisa} tersisa)
            </button>
          )}
        </>
      )}
    </section>
  );
}
