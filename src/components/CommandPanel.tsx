'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CeoCommand, CommandStatus } from '@/lib/types';

const STATUS_BADGE: Record<CommandStatus, string> = {
  baru: 'badge-baru',
  diproses: 'badge-diproses',
  selesai: 'badge-selesai',
};

const STATUS_TEKS: Record<CommandStatus, string> = {
  baru: 'Baru',
  diproses: 'Diproses',
  selesai: 'Selesai',
};

/** Tanggal & jam WIB dari string ISO */
function formatWaktu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export default function CommandPanel() {
  const [teks, setTeks] = useState('');
  const [perintah, setPerintah] = useState<CeoCommand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const mounted = useRef(true);

  const ambilPerintah = useCallback(async () => {
    try {
      const res = await fetch('/api/commands', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as CeoCommand[];
      if (!mounted.current) return;
      // Terbaru dulu (berdasarkan waktu dibuat)
      const urut = [...data].sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
      );
      setPerintah(urut);
    } catch {
      /* biarkan daftar terakhir; polling berikutnya mencoba lagi */
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void ambilPerintah();
    const t = setInterval(ambilPerintah, 3000);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [ambilPerintah]);

  async function kirimPerintah(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const isi = teks.trim();
    if (!isi) {
      setError('Perintah tidak boleh kosong — tulis dulu apa yang ingin kamu perintahkan.');
      return;
    }
    setError(null);
    setMengirim(true);
    try {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: isi }),
      });
      if (!res.ok) throw new Error(`Gagal mengirim perintah (kode ${res.status}). Coba lagi.`);
      setTeks('');
      await ambilPerintah();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim perintah. Coba lagi.');
    } finally {
      if (mounted.current) setMengirim(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="judul-perintah">
      <div className="panel-header">
        <h2 id="judul-perintah" className="panel-title">
          Perintah ke Noir
        </h2>
      </div>

      <form className="command-form" onSubmit={kirimPerintah} noValidate>
        <label className="field-label" htmlFor="input-perintah">
          Tulis perintah untuk Noir
        </label>
        <textarea
          id="input-perintah"
          className="input command-textarea"
          rows={3}
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder="Contoh: buatkan 3 ide konten tentang AI untuk minggu ini"
          aria-describedby={error ? 'error-perintah' : undefined}
          aria-invalid={error ? true : undefined}
          disabled={mengirim}
        />
        {error && (
          <p id="error-perintah" className="error-text" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={mengirim}>
          {mengirim ? 'Mengirim…' : 'Kirim Perintah'}
        </button>
      </form>

      <div className="command-list-wrap">
        <h3 className="list-subheading">Riwayat perintah</h3>
        {perintah.length === 0 ? (
          <p className="empty-state">Belum ada perintah. Kirim perintah pertamamu di atas.</p>
        ) : (
          <ul className="command-list">
            {perintah.map((c) => (
              <li key={c.id} className="command-item">
                <div className="command-item-top">
                  <span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS_TEKS[c.status]}</span>
                  <time className="command-time" dateTime={c.created_at}>
                    {formatWaktu(c.created_at)}
                  </time>
                </div>
                <p className="command-text">{c.text}</p>
                {c.status === 'selesai' && c.summary && (
                  <p className="command-summary">
                    <span className="command-summary-label">Hasil:</span> {c.summary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
