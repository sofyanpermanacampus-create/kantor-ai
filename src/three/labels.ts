// ============================================================================
// Kantor AI — src/three/labels.ts
// Label nama melayang (canvas sprite) dengan COLLISION HANDLING di screen-space.
//
// Prioritas (Bahasa Indonesia):
//   1. label agent LIVE   — selalu tampil; digeser vertikal bila bertabrakan
//   2. label ruangan      — mengalah: disembunyikan saat tabrakan dengan label
//                          agent, dibatasi jumlahnya agar tidak berdesakan
//   3. label ambient      — TIDAK dibuat (hanya badge "AMBIENT" di karakter)
//
// Algoritma: tiap frame, proyeksikan anchor dunia → piksel layar, lalu tempatkan
// rect label secara greedy sesuai prioritas. Offset screen-space dikonversi ke
// world-space memakai basis kamera (ortho fixed) sehingga sprite tetap menempel.
// ============================================================================

import * as THREE from 'three';

export type LabelKind = 'agent' | 'room';

export interface LabelOptions {
  id: string;
  /** baris utama — nama agent / nama ruangan (Bahasa Indonesia) */
  text: string;
  /** baris kecil kedua, mis. "Bekerja — menulis laporan" */
  sub?: string;
  kind: LabelKind;
  /** warna titik status (STATUS_COLOR) */
  dotColor?: string;
  /** prioritas manual; default: agent=100, room=10 */
  priority?: number;
  getWorldPos: () => THREE.Vector3;
}

interface Entry extends Required<Omit<LabelOptions, 'sub' | 'priority' | 'dotColor'>> {
  sub: string;
  dotColor: string;
  priority: number;
  sprite: THREE.Sprite;
  cssW: number;
  cssH: number;
  canvas: HTMLCanvasElement;
}

const DPR = 2;
const MAX_ROOM_LABELS = 14;
const PAD = 5; // px antar rect

export class LabelManager {
  private scene: THREE.Scene;
  private entries = new Map<string, Entry>();
  private screenW = 1;
  private screenH = 1;
  /** piksel per unit dunia (kamera ortho: konstan) */
  private ppu = 30;
  private tmpV = new THREE.Vector3();
  private tmpRight = new THREE.Vector3();
  private tmpUp = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ------------------------------------------------------------- API publik --
  addLabel(opts: LabelOptions): void {
    if (this.entries.has(opts.id)) {
      this.updateLabel(opts.id, { text: opts.text, sub: opts.sub, dotColor: opts.dotColor });
      return;
    }
    const canvas = document.createElement('canvas');
    const entry: Entry = {
      id: opts.id,
      text: opts.text,
      sub: opts.sub ?? '',
      kind: opts.kind,
      dotColor: opts.dotColor ?? '#9ca3af',
      priority: opts.priority ?? (opts.kind === 'agent' ? 100 : 10),
      getWorldPos: opts.getWorldPos,
      sprite: new THREE.Sprite(
        new THREE.SpriteMaterial({ transparent: true, depthTest: false }),
      ),
      cssW: 0,
      cssH: 0,
      canvas,
    };
    entry.sprite.renderOrder = 100;
    this.redraw(entry);
    this.scene.add(entry.sprite);
    this.entries.set(opts.id, entry);
  }

  updateLabel(id: string, patch: { text?: string; sub?: string; dotColor?: string }): void {
    const e = this.entries.get(id);
    if (!e) return;
    let dirty = false;
    if (patch.text !== undefined && patch.text !== e.text) {
      e.text = patch.text;
      dirty = true;
    }
    if (patch.sub !== undefined && patch.sub !== e.sub) {
      e.sub = patch.sub;
      dirty = true;
    }
    if (patch.dotColor !== undefined && patch.dotColor !== e.dotColor) {
      e.dotColor = patch.dotColor;
      dirty = true;
    }
    if (dirty) this.redraw(e);
  }

  removeLabel(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    const m = e.sprite.material as THREE.SpriteMaterial;
    if (m.map) m.map.dispose();
    m.dispose();
    this.scene.remove(e.sprite);
    this.entries.delete(id);
  }

  hasLabel(id: string): boolean {
    return this.entries.has(id);
  }

  /** Dipanggil saat resize / kamera berubah. */
  setScreen(w: number, h: number, pixelsPerUnit: number): void {
    this.screenW = Math.max(1, w);
    this.screenH = Math.max(1, h);
    this.ppu = Math.max(1, pixelsPerUnit);
    this.entries.forEach((e) => {
      e.sprite.scale.set(e.cssW / this.ppu, e.cssH / this.ppu, 1);
    });
  }

  /** Selesaikan collision & posisi — panggil tiap frame setelah update kamera. */
  update(camera: THREE.Camera): void {
    const { screenW: W, screenH: H, ppu } = this;
    this.tmpRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    this.tmpUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

    const sorted = Array.from(this.entries.values()).sort((a, b) => b.priority - a.priority);
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    let roomShown = 0;

    for (const e of sorted) {
      const anchor = e.getWorldPos();
      this.tmpV.copy(anchor).project(camera);
      // di belakang kamera / di luar frustum → sembunyikan
      if (this.tmpV.z > 1 || this.tmpV.z < -1) {
        e.sprite.visible = false;
        continue;
      }
      const sx = (this.tmpV.x * 0.5 + 0.5) * W;
      const sy = (-this.tmpV.y * 0.5 + 0.5) * H;
      const w = e.cssW;
      const h = e.cssH;

      if (e.kind === 'room') {
        if (roomShown >= MAX_ROOM_LABELS) {
          e.sprite.visible = false;
          continue;
        }
        const rect = { x: sx, y: sy, w, h };
        if (this.collides(rect, placed)) {
          e.sprite.visible = false; // ruangan mengalah
          continue;
        }
        this.place(e, anchor, sx, sy, 0, 0);
        placed.push(rect);
        roomShown++;
      } else {
        // agent live: coba beberapa offset vertikal sampai tidak bertabrakan
        const candidates = [0, -(h + 10), h + 10, -(2 * h + 16), 2 * h + 16];
        let done = false;
        for (const dy of candidates) {
          const rect = { x: sx, y: sy + dy, w, h };
          if (!this.collides(rect, placed)) {
            this.place(e, anchor, sx, sy, 0, dy);
            placed.push(rect);
            done = true;
            break;
          }
        }
        if (!done) {
          // tetap tampil di posisi aslinya (lebih baik terlihat daripada hilang)
          this.place(e, anchor, sx, sy, 0, 0);
          placed.push({ x: sx, y: sy, w, h });
        }
      }
    }
  }

  dispose(): void {
    this.entries.forEach((_e, id) => this.removeLabel(id));
  }

  // --------------------------------------------------------------- privat ---
  private place(e: Entry, anchor: THREE.Vector3, sx: number, sy: number, dx: number, dy: number): void {
    void sx;
    void sy;
    // offset screen-space → world-space via basis kamera
    e.sprite.position
      .copy(anchor)
      .addScaledVector(this.tmpRight, dx / this.ppu)
      .addScaledVector(this.tmpUp, dy / this.ppu);
    e.sprite.visible = true;
  }

  private collides(r: { x: number; y: number; w: number; h: number }, placed: Array<{ x: number; y: number; w: number; h: number }>): boolean {
    for (const q of placed) {
      const overlapX = Math.abs(r.x - q.x) * 2 < r.w + q.w + PAD * 2;
      const overlapY = Math.abs(r.y - q.y) * 2 < r.h + q.h + PAD * 2;
      if (overlapX && overlapY) return true;
    }
    return false;
  }

  /** Gambar ulang kanvas label (dipanggil saat dibuat / teks berubah). */
  private redraw(e: Entry): void {
    const ctx = e.canvas.getContext('2d');
    if (!ctx) return;
    const nameFont = `600 ${26 * DPR}px system-ui, -apple-system, sans-serif`;
    const subFont = `500 ${19 * DPR}px system-ui, -apple-system, sans-serif`;
    ctx.font = nameFont;
    const nameW = ctx.measureText(e.text).width / DPR;
    ctx.font = subFont;
    const subW = e.sub ? ctx.measureText(e.sub).width / DPR : 0;

    const dotD = 16;
    const padX = 14;
    const cssW = Math.ceil(Math.max(nameW, subW) + dotD + padX * 3);
    const cssH = e.sub ? 74 : 50;
    e.cssW = cssW;
    e.cssH = cssH;
    e.canvas.width = cssW * DPR;
    e.canvas.height = cssH * DPR;
    ctx.scale(DPR, DPR);

    // pil latar
    const r = 13;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, cssW - 1, cssH - 1, r);
    ctx.fillStyle = 'rgba(8, 11, 22, 0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // titik status
    const dotX = padX + dotD / 2;
    const dotY = e.sub ? 22 : cssH / 2;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotD / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = e.dotColor;
    ctx.fill();

    // nama
    ctx.font = nameFont;
    ctx.fillStyle = '#f2f5ff';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(e.text, padX + dotD + 8, e.sub ? 30 : 33);

    // sub (status/detail)
    if (e.sub) {
      ctx.font = subFont;
      ctx.fillStyle = '#9aa3c0';
      ctx.fillText(e.sub, padX + dotD + 8, 56);
    }

    const m = e.sprite.material as THREE.SpriteMaterial;
    const old = m.map;
    const tex = new THREE.CanvasTexture(e.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    m.map = tex;
    m.needsUpdate = true;
    if (old) old.dispose();
    e.sprite.scale.set(cssW / this.ppu, cssH / this.ppu, 1);
  }
}
