'use client';

import type { ActivitySnapshot } from '@/lib/types';
import { STATUS_COLOR, STATUS_LABEL_ID } from '@/lib/types';

interface ActivityLogProps {
  snapshot: ActivitySnapshot;
}

/** Jam WIB dari string ISO */
function formatJamWIB(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

export default function ActivityLog({ snapshot }: ActivityLogProps) {
  const agen = snapshot.agents ?? [];
  const adaAktivitas = agen.length > 0;

  return (
    <section className="panel" aria-labelledby="judul-aktivitas">
      <div className="panel-header">
        <h2 id="judul-aktivitas" className="panel-title">
          Aktivitas Live
        </h2>
        <span
          className={`badge ${adaAktivitas ? 'badge-live' : 'badge-ambient'}`}
          role="status"
        >
          {adaAktivitas ? `${agen.length} aktif` : 'AMBIENT'}
        </span>
      </div>

      {!adaAktivitas ? (
        <p className="empty-state" role="status">
          Belum ada aktivitas live — mode ambient.
        </p>
      ) : (
        <>
          <p className="panel-meta">Diperbarui {formatJamWIB(snapshot.updated_at)} WIB</p>
          <ul className="log-list">
            {agen.map((a) => {
              const warna = STATUS_COLOR[a.status];
              const label = STATUS_LABEL_ID[a.status];
              return (
                <li key={a.id} className="log-item">
                  <span
                    className="status-dot"
                    style={{ backgroundColor: warna }}
                    aria-hidden="true"
                  />
                  <div className="log-item-body">
                    <div className="log-item-top">
                      <span className="log-item-name">{a.name}</span>
                      <span className="log-item-status" style={{ color: warna }}>
                        {label}
                      </span>
                    </div>
                    {a.detail && <p className="log-item-detail">{a.detail}</p>}
                    <p className="log-item-divisi">{a.division}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
