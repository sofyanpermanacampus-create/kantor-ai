// ============================================================================
// Kantor AI — src/three/characters.ts
// Pabrik karakter pixel/voxel 3D PROSEDURAL dari BoxGeometry.
// BUKAN sprite 2D, BUKAN CSS, BUKAN emoji — WebGL 3D murni.
//
// Budget performa (Technical Artist):
//   - 1 unit BoxGeometry dipakai bersama SEMUA bagian SEMUA karakter
//   - cache MeshLambertMaterial per warna (material murah, tanpa map)
//   - 1 karakter ≈ 12 mesh (≈144 tris) → 60 karakter ≈ 720 draw call ringan,
//     aman 60fps di WebGL desktop
// Animasi per status: working (mengetik), reading (menunduk+buku),
// running (bergerak antar titik), idle (napas), waiting (mondar-mandir + "?"),
// done (lompat + centang).
// ============================================================================

import * as THREE from 'three';
import type { AgentStatus } from '../lib/types';
import { STATUS_COLOR } from '../lib/types';

// ------------------------------------------------------------- shared -------
const unitBox = new THREE.BoxGeometry(1, 1, 1);

interface MatOpts {
  transparent?: boolean;
  opacity?: number;
}
const matCache = new Map<string, THREE.MeshLambertMaterial>();
function cmat(color: string, opts: MatOpts = {}): THREE.MeshLambertMaterial {
  const key = `${color}|${opts.transparent ? 1 : 0}|${opts.opacity ?? 1}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
    matCache.set(key, m);
  }
  return m;
}

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Satu bagian tubuh: box ber-volume. y = alas bagian. */
function part(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  color: string,
  x: number,
  y: number,
  z: number,
  ghost: boolean,
): THREE.Mesh {
  const m = new THREE.Mesh(unitBox, cmat(color, ghost ? { transparent: true, opacity: 0.55 } : {}));
  m.scale.set(w, h, d);
  m.position.set(x, y + h / 2, z);
  m.castShadow = !ghost;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

// ------------------------------------------------------- sprite kanvas ------
function makeTextSprite(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 128, h = 128): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.renderOrder = 50;
  return sp;
}

function statusMarkSprite(kind: 'tanya' | 'centang'): THREE.Sprite {
  return makeTextSprite((ctx, w, h) => {
    ctx.font = `900 ${Math.floor(h * 0.72)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const txt = kind === 'tanya' ? '?' : '✓';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(10,12,20,0.85)';
    ctx.strokeText(txt, w / 2, h / 2);
    ctx.fillStyle = kind === 'tanya' ? STATUS_COLOR.waiting : STATUS_COLOR.done;
    ctx.fillText(txt, w / 2, h / 2);
  });
}

function ambientBadgeSprite(): THREE.Sprite {
  const sp = makeTextSprite(
    (ctx, w, h) => {
      ctx.font = `700 ${Math.floor(h * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = 'AMBIENT';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(20,24,38,0.72)';
      const pad = 14;
      ctx.beginPath();
      ctx.roundRect((w - tw) / 2 - pad, h * 0.22, tw + pad * 2, h * 0.56, 14);
      ctx.fill();
      ctx.fillStyle = '#c8cfe6';
      ctx.fillText(label, w / 2, h / 2 + 2);
    },
    256,
    96,
  );
  sp.scale.set(1.7, 0.64, 1);
  return sp;
}

// ------------------------------------------------------------------ kelas ---
export interface CharacterOptions {
  /** nama agent (dipakai untuk variasi deterministik) */
  name: string;
  /** warna baju (css) — biasanya divisionColor(index divisi) */
  shirtColor: string;
  /** true → hantu abu-abu semi-transparan untuk MODE AMBIENT */
  ambient?: boolean;
}

export class AgentCharacter {
  readonly group = new THREE.Group();
  readonly name: string;
  readonly ambient: boolean;

  private status: AgentStatus = 'idle';
  private phase: number;
  private home = new THREE.Vector3();
  private groundY = 0;
  private wanderMin = new THREE.Vector3(-30, 0, -20);
  private wanderMax = new THREE.Vector3(30, 10, 20);
  private waypoint = new THREE.Vector3();
  private paceDir = 1;

  private body!: THREE.Group;
  private headG!: THREE.Group;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private book!: THREE.Mesh;
  private markTanya!: THREE.Sprite;
  private markCentang!: THREE.Sprite;
  private badge?: THREE.Sprite;

  constructor(opts: CharacterOptions) {
    this.name = opts.name;
    this.ambient = opts.ambient ?? false;
    this.phase = (hashStr(opts.name) % 1000) / 1000 * Math.PI * 2;
    const ghost = this.ambient;
    const h = hashStr(opts.name);
    const skin = ghost ? '#9aa3b2' : SKIN[h % SKIN.length];
    const shirt = ghost ? '#9aa3b2' : opts.shirtColor;
    const pants = ghost ? '#8a93a5' : '#2e3447';
    const hairC = ghost ? '#7c8494' : opts.shirtColor;

    const body = new THREE.Group();
    this.group.add(body);
    this.body = body;

    // kaki
    part(body, 0.24, 0.7, 0.24, pants, -0.15, 0, 0, ghost);
    part(body, 0.24, 0.7, 0.24, pants, 0.15, 0, 0, ghost);
    // badan
    part(body, 0.64, 0.72, 0.38, shirt, 0, 0.7, 0, ghost);
    // lengan: pivot di bahu agar bisa diayun
    const mkArm = (sx: number): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(sx, 1.34, 0);
      const m = new THREE.Mesh(unitBox, cmat(shirt, ghost ? { transparent: true, opacity: 0.55 } : {}));
      m.scale.set(0.19, 0.62, 0.19);
      m.position.y = -0.31;
      m.castShadow = !ghost;
      g.add(m);
      // tangan mungil
      const hand = new THREE.Mesh(unitBox, cmat(skin, ghost ? { transparent: true, opacity: 0.55 } : {}));
      hand.scale.set(0.17, 0.14, 0.17);
      hand.position.y = -0.68;
      g.add(hand);
      body.add(g);
      return g;
    };
    this.armL = mkArm(-0.42);
    this.armR = mkArm(0.42);

    // kepala: grup agar bisa menunduk (reading)
    const headG = new THREE.Group();
    headG.position.set(0, 1.42, 0);
    const head = new THREE.Mesh(unitBox, cmat(skin, ghost ? { transparent: true, opacity: 0.55 } : {}));
    head.scale.set(0.48, 0.46, 0.44);
    head.position.y = 0.23;
    head.castShadow = !ghost;
    headG.add(head);
    if (!ghost) {
      // mata voxel
      for (const ex of [-0.11, 0.11]) {
        const eye = new THREE.Mesh(unitBox, cmat('#14161f'));
        eye.scale.set(0.07, 0.09, 0.02);
        eye.position.set(ex, 0.26, 0.23);
        headG.add(eye);
      }
      // rambut: topi voxel warna divisi
      const hair = new THREE.Mesh(unitBox, cmat(hairC));
      hair.scale.set(0.52, 0.13, 0.48);
      hair.position.y = 0.5;
      headG.add(hair);
    }
    body.add(headG);
    this.headG = headG;

    // buku (reading)
    this.book = part(body, 0.42, 0.07, 0.32, '#d8b25c', 0, 1.02, 0.42, ghost);
    this.book.visible = false;

    // penanda status melayang
    this.markTanya = statusMarkSprite('tanya');
    this.markTanya.scale.set(0.85, 0.85, 1);
    this.markTanya.position.set(0, 2.45, 0);
    this.markTanya.visible = false;
    this.group.add(this.markTanya);

    this.markCentang = statusMarkSprite('centang');
    this.markCentang.scale.set(0.85, 0.85, 1);
    this.markCentang.position.set(0, 2.45, 0);
    this.markCentang.visible = false;
    this.group.add(this.markCentang);

    if (ghost) {
      this.badge = ambientBadgeSprite();
      this.badge.position.set(0, 2.5, 0);
      this.group.add(this.badge);
    }

    this.waypoint.set(0, 0, 0);
    this.applyStatusVisual();
  }

  // ------------------------------------------------------------ API publik --
  setStatus(s: AgentStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.groundY = this.group.position.y;
    if (s === 'running' || this.ambient) this.pickWaypoint();
    this.applyStatusVisual();
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  /** Posisi "meja" karakter (slot di areanya). */
  setHome(p: THREE.Vector3): void {
    this.home.copy(p);
    this.groundY = p.y;
  }

  getHome(): THREE.Vector3 {
    return this.home;
  }

  setWanderBounds(min: THREE.Vector3, max: THREE.Vector3): void {
    this.wanderMin.copy(min);
    this.wanderMax.copy(max);
  }

  /** Teleport instan (dipakai saat pertama dibuat). */
  snapToHome(): void {
    this.group.position.copy(this.home);
    this.groundY = this.home.y;
  }

  /** Titik label nama melayang (di atas kepala). */
  labelAnchor(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.group.position).add(LABEL_UP);
  }

  update(dt: number, t: number): void {
    const p = this.phase;
    const g = this.group;

    // reset pose netral tiap frame
    this.body.rotation.set(0, 0, 0);
    this.body.scale.set(1, 1, 1);
    this.headG.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0.12);
    this.armR.rotation.set(0, 0, -0.12);

    if (this.ambient) {
      this.updateWander(dt, t, p, 1.4);
      this.body.scale.y = 1 + 0.02 * Math.sin(t * 2 + p);
      if (this.badge) this.badge.position.y = 2.5 + 0.08 * Math.sin(t * 1.6 + p);
      return;
    }

    switch (this.status) {
      case 'working': {
        // duduk di meja: lengan ke depan mengetik bergantian
        this.moveToward(this.home, dt, 4);
        this.body.rotation.x = 0.1;
        const k = Math.sin(t * 9 + p);
        this.armL.rotation.x = -1.05 + k * 0.28;
        this.armR.rotation.x = -1.05 - k * 0.28;
        this.headG.rotation.x = 0.18;
        break;
      }
      case 'reading': {
        this.moveToward(this.home, dt, 4);
        this.headG.rotation.x = 0.48; // menunduk ke buku
        this.headG.rotation.y = 0.16 * Math.sin(t * 0.9 + p);
        this.armL.rotation.x = -0.85;
        this.armR.rotation.x = -0.85;
        this.body.rotation.x = 0.05;
        break;
      }
      case 'running': {
        this.updateWander(dt, t, p, 6.2);
        // ayunan lengan + badan membungkuk + memantul
        const s = Math.sin(t * 11 + p);
        this.armL.rotation.x = s * 0.85;
        this.armR.rotation.x = -s * 0.85;
        this.body.rotation.x = 0.16;
        g.position.y += Math.abs(Math.sin(t * 11 + p)) * 0.14;
        break;
      }
      case 'waiting': {
        // mondar-mandir kecil di sekitar home
        const target = _v1.copy(this.home);
        target.x += this.paceDir * 1.1;
        this.moveToward(target, dt, 1.6);
        if (g.position.distanceTo(target) < 0.25) this.paceDir *= -1;
        g.rotation.y = this.paceDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        const s = Math.sin(t * 7 + p);
        this.armL.rotation.x = s * 0.4;
        this.armR.rotation.x = -s * 0.4;
        this.markTanya.position.y = 2.45 + 0.12 * Math.sin(t * 3 + p);
        break;
      }
      case 'done': {
        this.moveToward(this.home, dt, 4);
        // lompat kecil berulang + tangan ke atas
        g.position.y = this.groundY + Math.abs(Math.sin(t * 3.2 + p)) * 0.42;
        this.armL.rotation.x = -2.7;
        this.armR.rotation.x = -2.7;
        this.markCentang.position.y = 2.45 + 0.12 * Math.sin(t * 3.2 + p);
        break;
      }
      case 'idle':
      default: {
        this.moveToward(this.home, dt, 4);
        // bernapas + kepala menoleh pelan
        this.body.scale.y = 1 + 0.018 * Math.sin(t * 2.1 + p);
        this.headG.rotation.y = 0.45 * Math.sin(t * 0.45 + p);
        this.armL.rotation.x = 0.06 * Math.sin(t * 2.1 + p);
        this.armR.rotation.x = 0.06 * Math.sin(t * 2.1 + p + 1);
        break;
      }
    }
  }

  dispose(): void {
    // Hanya dispose sumber daya per-karakter (tekstur kanvas).
    // Geometri & material BERSAMA (unitBox, matCache) tidak boleh di-dispose.
    for (const sp of [this.markTanya, this.markCentang, this.badge]) {
      if (!sp) continue;
      const m = sp.material as THREE.SpriteMaterial;
      if (m.map) m.map.dispose();
      m.dispose();
    }
    this.group.removeFromParent();
  }

  // ---------------------------------------------------------- privat --------
  private applyStatusVisual(): void {
    const s = this.status;
    this.book.visible = s === 'reading';
    this.markTanya.visible = s === 'waiting';
    this.markCentang.visible = s === 'done';
  }

  private moveToward(target: THREE.Vector3, dt: number, speed: number): void {
    const g = this.group;
    _v1.copy(target).sub(g.position);
    const dist = _v1.length();
    if (dist < 0.02) return;
    const step = Math.min(dist, speed * dt);
    g.position.addScaledVector(_v1.normalize(), step);
    // hadap arah gerak (kecuali waiting yang mengatur sendiri)
    if (this.status !== 'waiting' && (Math.abs(_v1.x) > 0.01 || Math.abs(_v1.z) > 0.01)) {
      const want = Math.atan2(_v1.x, _v1.z);
      g.rotation.y += (want - g.rotation.y) * Math.min(1, 8 * dt);
    }
  }

  private pickWaypoint(): void {
    const { x: x0, y: y0, z: z0 } = this.wanderMin;
    const { x: x1, y: y1, z: z1 } = this.wanderMax;
    this.waypoint.set(
      x0 + Math.random() * (x1 - x0),
      y0 + Math.random() * (y1 - y0),
      z0 + Math.random() * (z1 - z0),
    );
  }

  private updateWander(dt: number, t: number, p: number, speed: number): void {
    const g = this.group;
    _v1.copy(this.waypoint).sub(g.position);
    _v1.y *= 0.6; // transisi lantai lebih landai
    if (_v1.length() < 0.6) this.pickWaypoint();
    else {
      const step = Math.min(_v1.length(), speed * dt);
      g.position.addScaledVector(_v1.normalize(), step);
      if (Math.abs(_v1.x) > 0.05 || Math.abs(_v1.z) > 0.05) {
        const want = Math.atan2(_v1.x, _v1.z);
        let d = want - g.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        g.rotation.y += d * Math.min(1, 6 * dt);
      }
    }
    // langkah kecil
    const s = Math.sin(t * 8 + p);
    this.armL.rotation.x = s * 0.5;
    this.armR.rotation.x = -s * 0.5;
  }
}

const _v1 = new THREE.Vector3();
const LABEL_UP = new THREE.Vector3(0, 2.35, 0);

/** Pabrik cepat — dipakai OfficeScene. */
export function createAgentCharacter(opts: CharacterOptions): AgentCharacter {
  return new AgentCharacter(opts);
}
