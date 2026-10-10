# Kantor AI

Webapp monitoring/orchestration 3D untuk agent-agency: **267 agent** dalam **18 divisi** divisualisasikan sebagai gedung kantor mewah bergaya diorama isometric 3D (Three.js/WebGL asli — bukan CSS-flat).

Satu agent aktif = satu karakter pixel 3D prosedural yang animasinya mencerminkan status nyatanya: `working` (mengetik), `reading` (membaca), `running` (berlari), `idle` (diam), `waiting` (menunggu), `done` (selesai).

## Cara menjalankan

```bash
cd kantor-ai
npm install
npm run dev      # http://localhost:3000
npm run build    # verifikasi production build
npm start        # jalankan hasil build
```

## Cara kerja live feed

1. Sistem eksternal (mis. Noir/CEO) mengirim snapshot via:
   ```bash
   curl -X POST http://localhost:3000/api/activity \
     -H 'Content-Type: application/json' \
     -d '{"agents":[{"id":"engineering-engineering-frontend-developer","name":"Frontend Developer","division":"Engineering","status":"working","detail":"Membangun HUD"}],"updated_at":"2026-10-10T06:35:00Z"}'
   ```
   Format: `{ agents: [{id, name, division, status, detail?}], updated_at: ISO-8601 UTC }`.
   Status valid: `working | reading | running | idle | waiting | done`.
2. Frontend mem-poll `GET /api/activity` tiap 2 detik dan me-render karakter 3D.
3. Jika tidak ada data live (kosong/basi > 15 detik) → **mode AMBIENT**: karakter abu-abu semi-transparan berkeliaran prosedural, jelas dibedakan dari data live. Tidak ada dummy yang disamarkan sebagai live.

## Panel "Perintah ke Noir"

- Ketik perintah bahasa natural di panel → `POST /api/commands` (status `baru`).
- Noir/eksternal: `POST /api/commands/ack` `{id}` → `diproses`; `POST /api/commands/complete` `{id, summary?}` → `selesai` + ringkasan.
- `GET /api/commands` mengembalikan antrean (terbaru dulu).

## Struktur proyek

```
src/
  app/
    page.tsx            # orchestrator: poll /api/activity tiap 2 dtk
    layout.tsx, globals.css
    api/
      activity/route.ts          # GET + POST report_agent_activity
      commands/route.ts          # GET get_ceo_commands + POST buat perintah
      commands/ack/route.ts      # POST ack_ceo_command
      commands/complete/route.ts # POST complete_ceo_command
  components/
    OfficeScene.tsx     # canvas Three.js (dynamic import, ssr:false)
    Hud.tsx             # jam WIB, badge LIVE/AMBIENT, counter agent
    CommandPanel.tsx    # panel "Perintah ke Noir"
    ActivityLog.tsx     # log aktivitas live
    AgentDirectory.tsx  # direktori 267 agent + filter + status live
  lib/
    types.ts            # kontrak data bersama
    store.ts            # persistensi JSON (data/*.json)
    agents-data.ts      # 267 agent, 18 divisi (auto-generate dari INDEX.md)
  three/
    office.ts           # gedung cutaway 3 lantai (lobby, pool, musholla,
                        #   18 area divisi, ruang owner, rooftop café)
    characters.ts       # karakter voxel prosedural + 6 animasi status
    labels.ts           # label nama melayang + collision handling
data/                   # activity.json, commands.json (dibuat otomatis)
```

## Deploy ke Vercel

```bash
vercel --prod
# atau hubungkan repo GitHub di dashboard Vercel (framework preset: Next.js)
```

> **Limitasi jujur:** `store.ts` memakai file JSON lokal (`data/`). Di Vercel (serverless) state tidak persisten antar invocasi dan antar region — cukup untuk demo, tapi produksi butuh Vercel KV/Postgres. Render 3D belum di-screenshot di browser (VM tanpa akses browser live); kode lolos `tsc` + `npm run build` + smoke test logika 400 frame.

## Kredit build

Dikerjakan divisi Game Development (Technical Artist) + Engineering (Senior Developer, Frontend Developer, Backend Architect) + Design (UI Designer), dikoordinasikan sebagai Koordinator Build.
