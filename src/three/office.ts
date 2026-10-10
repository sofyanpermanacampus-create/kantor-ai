// ============================================================================
// Kantor AI — src/three/office.ts
// Gedung kantor cutaway 3D prosedural (dollhouse): 3 lantai, tanpa dinding
// depan agar kamera isometrik bisa melihat ke dalam.
//
// Layout:
//   Lantai dasar (y=0)  : Lobi + Kolam Renang + Musholla
//   Lantai 2    (y=5)  : 18 area divisi dalam grid 6×3 (urutan = DIVISIONS)
//   Lantai 3    (y=10) : Ruang Owner + Kafe Rooftop (tanpa atap, langit terbuka)
//
// Semua mesh memakai SATU unit BoxGeometry + cache MeshLambertMaterial per warna
// (keputusan performa: draw call murah, 12 tris per box, tanpa tekstur).
// ============================================================================

import * as THREE from 'three';

// ---------------------------------------------------------------- konstanta --
export const FLOOR_H = 5; // tinggi antar lantai
export const BLDG_W = 64; // sumbu X
export const BLDG_D = 44; // sumbu Z
export const SLAB_T = 0.45;

export const FLOOR_NAMES_ID = ['Lantai Dasar', 'Lantai 2 — Divisi', 'Lantai 3 — Owner & Rooftop'];

// ------------------------------------------------------------------ tipe ----
export interface DivisionArea {
  index: number;
  name: string; // nama divisi (dari DIVISIONS)
  center: THREE.Vector3; // titik tengah area, di permukaan lantai
  size: { w: number; d: number };
  labelAnchor: THREE.Vector3; // posisi label ruangan
  color: string; // warna identitas area (HSL css)
}

export interface RoomInfo {
  id: string;
  name: string; // Bahasa Indonesia
  labelAnchor: THREE.Vector3;
}

export interface OfficeModel {
  group: THREE.Group;
  /** y permukaan tiap lantai (atas slab) */
  floorY: number[];
  /** 18 area divisi — index SELALU cocok urutan DIVISIONS */
  divisionAreas: DivisionArea[];
  rooms: RoomInfo[];
  lobbyAnchor: THREE.Vector3;
  bounds: { min: THREE.Vector3; max: THREE.Vector3 };
}

// ------------------------------------------------- geometri & material -------
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map<string, THREE.MeshLambertMaterial>();

export function mat(color: string): THREE.MeshLambertMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}

/** Warna identitas divisi ke-i dari 18 divisi — dipakai area, karakter, label. */
export function divisionColor(i: number): string {
  return `hsl(${(i * 360) / 18}, 62%, 58%)`;
}

/** Gambar satu box ber-volume ke dalam group. y = alas box. */
function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  color: string,
  x: number,
  y: number,
  z: number,
  opts: { shadow?: boolean; ry?: number } = {},
): THREE.Mesh {
  const m = new THREE.Mesh(unitBox, mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y + h / 2, z);
  if (opts.ry) m.rotation.y = opts.ry;
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// --------------------------------------------------------------- furniture ---
/** Meja kerja: papan + 2 panel kaki. Mengembalikan tinggi permukaan. */
function desk(g: THREE.Object3D, x: number, y: number, z: number, color: string, ry = 0): number {
  const top = 0.78;
  box(g, 1.7, 0.08, 0.85, color, x, y + top - 0.08, z, { ry });
  // kaki panel (disederhanakan: 2 panel, diputar mengikuti ry)
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const off = 0.72;
  for (const sgn of [-1, 1]) {
    const lx = x + sgn * off * c;
    const lz = z - sgn * off * s;
    box(g, 0.07, top - 0.08, 0.8, '#6b4a2f', lx, y, lz, { ry });
  }
  // monitor mungil di atas meja
  box(g, 0.5, 0.32, 0.05, '#1c2130', x, y + top, z, { ry });
  box(g, 0.12, 0.1, 0.12, '#3a3f52', x, y + top, z, { ry });
  return y + top;
}

function chair(g: THREE.Object3D, x: number, y: number, z: number, color: string, ry = 0): void {
  box(g, 0.5, 0.09, 0.5, color, x, y + 0.45, z, { ry });
  box(g, 0.5, 0.6, 0.09, color, x, y + 0.54, z, { ry });
  box(g, 0.08, 0.45, 0.08, '#4a3b2c', x - 0.18, y, z - 0.18, { ry });
  box(g, 0.08, 0.45, 0.08, '#4a3b2c', x + 0.18, y, z - 0.18, { ry });
  box(g, 0.08, 0.45, 0.08, '#4a3b2c', x - 0.18, y, z + 0.18, { ry });
  box(g, 0.08, 0.45, 0.08, '#4a3b2c', x + 0.18, y, z + 0.18, { ry });
}

function sofa(g: THREE.Object3D, x: number, y: number, z: number, color: string, ry = 0): void {
  box(g, 2.2, 0.35, 0.9, color, x, y + 0.12, z, { ry });
  box(g, 2.2, 0.55, 0.22, color, x, y + 0.47, z, { ry });
  box(g, 0.22, 0.5, 0.9, color, x - 0.99, y + 0.47, z, { ry });
  box(g, 0.22, 0.5, 0.9, color, x + 0.99, y + 0.47, z, { ry });
}

function plant(g: THREE.Object3D, x: number, y: number, z: number): void {
  box(g, 0.45, 0.5, 0.45, '#8a5a3b', x, y, z);
  box(g, 0.5, 0.7, 0.5, '#2f8f4e', x, y + 0.5, z);
  box(g, 0.34, 0.4, 0.34, '#3aa657', x, y + 1.05, z);
}

/** Papan nama area: tiang + papan berwarna divisi. */
function signBoard(g: THREE.Object3D, x: number, y: number, z: number, color: string): void {
  box(g, 0.12, 1.6, 0.12, '#3a3f52', x, y, z);
  box(g, 2.4, 0.5, 0.1, color, x, y + 1.6, z);
}

// ------------------------------------------------------------- pembangunan ---
/**
 * Bangun seluruh gedung. `divisionNames` harus DIVISIONS.map(d => d.name)
 * (18 nama, urutan dipertahankan) — area[i] <=> DIVISIONS[i].
 */
export function buildOffice(divisionNames: string[]): OfficeModel {
  const group = new THREE.Group();
  const floorY = [0, FLOOR_H, FLOOR_H * 2];

  const x0 = -BLDG_W / 2;
  const z0 = -BLDG_D / 2;

  // ---------------------------------------------------------- slab & dinding
  // Warna hangat: lantai kayu, dinding krem.
  const FLOOR_C = '#a97e52';
  const FLOOR_ALT = '#9c744c';
  const WALL_C = '#e8dcc4';
  const WALL_IN = '#dccbA6';

  for (let f = 0; f < 3; f++) {
    const y = floorY[f];
    // slab lantai (alas di y - SLAB_T agar permukaan tepat di y)
    box(group, BLDG_W, SLAB_T, BLDG_D, f % 2 === 0 ? FLOOR_C : FLOOR_ALT, 0, y - SLAB_T, 0, { shadow: false });
    // listplank tepi slab
    box(group, BLDG_W + 0.3, 0.18, BLDG_D + 0.3, '#7c5a38', 0, y - SLAB_T - 0.18, 0, { shadow: false });
  }

  // Dinding BELAKANG saja (cutaway): sisi x = -W/2 dan sisi z = -D/2.
  // Sisi +x / +z dibiarkan terbuka menghadap kamera isometrik.
  const wallT = 0.4;
  for (let f = 0; f < 3; f++) {
    const y = floorY[f];
    // dinding kiri (x = x0)
    box(group, wallT, FLOOR_H, BLDG_D, WALL_C, x0 + wallT / 2, y, z0 + BLDG_D / 2, { shadow: false });
    // dinding belakang (z = z0)
    box(group, BLDG_W, FLOOR_H, wallT, WALL_IN, x0 + BLDG_W / 2, y, z0 + wallT / 2, { shadow: false });
    // kolom sudut depan (estetika, tidak menutup pandangan)
    box(group, 0.5, FLOOR_H, 0.5, '#8a6a44', -x0 - 0.25, y, -z0 - 0.25);
    box(group, 0.5, FLOOR_H, 0.5, '#8a6a44', x0 + 0.25, y, -z0 - 0.25);
  }
  // Atap: TIDAK dipasang (lantai 3 = rooftop terbuka; cutaway butuh cahaya masuk)

  // ============================================================ LANTAI DASAR
  const gY = floorY[0];
  const rooms: RoomInfo[] = [];

  // ---- Lobi (tengah-kiri) ----
  const lobbyX = -4;
  const lobbyZ = 6;
  // meja resepsionis
  box(group, 4.2, 1.05, 0.9, '#7c5a38', lobbyX, gY, lobbyZ - 4);
  box(group, 4.4, 0.08, 1.0, '#a97e52', lobbyX, gY + 1.05, lobbyZ - 4);
  // sofa tunggu + meja kopi
  sofa(group, lobbyX - 4, gY, lobbyZ + 4, '#5b6fd6');
  sofa(group, lobbyX + 4, gY, lobbyZ + 4, '#5b6fd6', Math.PI);
  box(group, 1.2, 0.4, 0.7, '#6b4a2f', lobbyX, gY, lobbyZ + 4);
  plant(group, lobbyX - 8, gY, lobbyZ - 2);
  plant(group, lobbyX + 8, gY, lobbyZ - 2);
  // karpet lobi
  box(group, 10, 0.04, 6, '#b3543f', lobbyX, gY, lobbyZ + 1, { shadow: false });
  const lobbyAnchor = new THREE.Vector3(lobbyX, gY, lobbyZ + 1);
  rooms.push({ id: 'lobi', name: 'Lobi', labelAnchor: new THREE.Vector3(lobbyX, gY + 3.4, lobbyZ) });

  // ---- Kolam renang (kanan) ----
  const poolX = 22;
  const poolZ = -11;
  // dek kolam
  box(group, 16, 0.25, 14, '#c9b48a', poolX, gY, poolZ, { shadow: false });
  // bak air
  box(group, 11, 0.9, 8, '#3f7fbf', poolX, gY + 0.25, poolZ);
  box(group, 10.2, 0.2, 7.2, '#5fb3e8', poolX, gY + 0.75, poolZ, { shadow: false });
  // tepi kolam
  box(group, 12, 0.25, 0.5, '#e8e0cc', poolX, gY + 0.9, poolZ - 4.25);
  box(group, 12, 0.25, 0.5, '#e8e0cc', poolX, gY + 0.9, poolZ + 4.25);
  // kursi santai
  for (let i = -1; i <= 1; i++) {
    box(group, 0.7, 0.35, 1.8, '#e8e0cc', poolX + i * 3.4, gY + 0.25, poolZ + 6.2, { ry: 0.2 * i });
  }
  rooms.push({ id: 'kolam', name: 'Kolam Renang', labelAnchor: new THREE.Vector3(poolX, gY + 3.2, poolZ) });

  // ---- Musholla (kiri) ----
  const musX = -22;
  const musZ = -11;
  // partisi rendah pembatas (bukan dinding penuh — tetap terlihat)
  box(group, 0.25, 1.4, 12, WALL_C, musX + 8, gY, musZ, { shadow: false });
  // mihrab (ceruk penanda kiblat) di dinding belakang
  box(group, 2.2, 2.4, 0.3, '#8a6a44', musX, gY, z0 + 0.5);
  // sajadah: 2 baris × 4
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      box(group, 0.9, 0.05, 1.6, r % 2 ? '#3f6fbf' : '#4a7fd6', musX - 3 + c * 1.6, gY, musZ - 2 + r * 2.4, { shadow: false });
    }
  }
  // rak Al-Qur'an mungil
  box(group, 1.6, 1.0, 0.4, '#7c5a38', musX + 6, gY, z0 + 1.2);
  rooms.push({ id: 'musholla', name: 'Musholla', labelAnchor: new THREE.Vector3(musX, gY + 3.2, musZ) });

  // ============================================================ LANTAI 2 — 18 divisi
  const f2Y = floorY[1];
  const divisionAreas: DivisionArea[] = [];
  const cols = 6;
  const rows = 3;
  const cellW = BLDG_W / cols;
  const cellD = BLDG_D / rows;

  for (let i = 0; i < 18; i++) {
    const name = divisionNames[i] ?? `Divisi ${i + 1}`;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = x0 + cellW * (col + 0.5);
    const cz = z0 + cellD * (row + 0.5);
    const color = divisionColor(i);

    // karpet area berwarna identitas divisi + garis pembatas tipis
    box(group, cellW - 0.6, 0.05, cellD - 0.6, color, cx, f2Y, cz, { shadow: false });
    // papan nama area di sudut belakang
    signBoard(group, cx - cellW / 2 + 1.6, f2Y, cz - cellD / 2 + 1.2, color);

    // 2 set meja+kursi per area (slot karakter live)
    const deskColor = '#8a6a44';
    desk(group, cx - 1.6, f2Y, cz + 1.2, deskColor, 0);
    chair(group, cx - 1.6, f2Y, cz + 2.6, '#3a3f52', Math.PI);
    desk(group, cx + 1.6, f2Y, cz + 1.2, deskColor, 0);
    chair(group, cx + 1.6, f2Y, cz + 2.6, '#3a3f52', Math.PI);
    // rak arsip kecil
    box(group, 1.4, 1.8, 0.5, '#6b4a2f', cx + cellW / 2 - 1.2, f2Y, cz - cellD / 2 + 1.4);
    plant(group, cx - cellW / 2 + 1.0, f2Y, cz + cellD / 2 - 1.4);

    divisionAreas.push({
      index: i,
      name,
      center: new THREE.Vector3(cx, f2Y, cz),
      size: { w: cellW, d: cellD },
      labelAnchor: new THREE.Vector3(cx, f2Y + 3.6, cz - 1),
      color,
    });
  }

  // ============================================================ LANTAI 3
  const f3Y = floorY[2];

  // ---- Ruang Owner (kiri) ----
  const ownX = -16;
  const ownZ = 0;
  // partisi kaca rendah (tetap terlihat dari kamera)
  box(group, 0.2, 1.6, 22, '#9fc3d8', ownX + 15, f3Y, ownZ, { shadow: false });
  // meja direktur besar
  box(group, 3.4, 0.1, 1.6, '#5e4128', ownX, f3Y + 0.78, ownZ);
  box(group, 3.2, 0.78, 1.4, '#4a3421', ownX, f3Y, ownZ);
  box(group, 0.6, 0.4, 0.06, '#1c2130', ownX - 0.4, f3Y + 0.88, ownZ, { ry: 0.3 });
  chair(group, ownX, f3Y, ownZ + 1.8, '#2b2f45', Math.PI);
  // sofa tamu + rak buku
  sofa(group, ownX - 6, f3Y, ownZ + 6, '#7c5a8a', Math.PI / 2);
  box(group, 3.0, 2.2, 0.5, '#6b4a2f', ownX - 10, f3Y, z0 + 1.0);
  for (let s = 0; s < 3; s++) {
    for (let b = 0; b < 6; b++) {
      box(group, 0.28, 0.5, 0.3, divisionColor((s * 6 + b) % 18), ownX - 11 + b * 0.42, f3Y + 0.35 + s * 0.65, z0 + 1.0, { shadow: false });
    }
  }
  // papan nama "SOFYAN" di meja
  box(group, 1.6, 0.35, 0.08, '#e8dcc4', ownX, f3Y + 0.88, ownZ - 0.6);
  plant(group, ownX + 8, f3Y, ownZ - 6);
  rooms.push({ id: 'owner', name: 'Ruang Owner', labelAnchor: new THREE.Vector3(ownX, f3Y + 3.6, ownZ) });

  // ---- Kafe Rooftop (kanan, tanpa atap) ----
  const cafeX = 16;
  const cafeZ = 2;
  // lantai rooftop: ubin lebih terang
  box(group, 30, 0.06, 36, '#cbb894', cafeX, f3Y, cafeZ, { shadow: false });
  // counter bar
  box(group, 5.0, 1.05, 1.1, '#7c5a38', cafeX - 8, f3Y, cafeZ - 10);
  box(group, 5.2, 0.08, 1.3, '#a97e52', cafeX - 8, f3Y + 1.05, cafeZ - 10);
  // 3 set meja bundar + kursi + payung
  const cafeSpots: Array<[number, number]> = [
    [cafeX - 2, cafeZ - 2],
    [cafeX + 5, cafeZ + 3],
    [cafeX - 1, cafeZ + 8],
  ];
  for (const [tx, tz] of cafeSpots) {
    box(group, 0.12, 0.95, 0.12, '#4a3b2c', tx, f3Y, tz); // kaki meja
    box(group, 1.5, 0.08, 1.5, '#e8e0cc', tx, f3Y + 0.95, tz); // taplak
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      chair(group, tx + Math.cos(a) * 1.4, f3Y, tz + Math.sin(a) * 1.4, '#8a5a3b', -a + Math.PI / 2);
    }
    // payung
    box(group, 0.08, 2.6, 0.08, '#4a3b2c', tx + 2.2, f3Y, tz + 2.2);
    box(group, 2.6, 0.12, 2.6, '#d66a5a', tx + 2.2, f3Y + 2.6, tz + 2.2, { ry: Math.PI / 4 });
  }
  // railing rooftop di tepi terbuka
  for (let rx = x0 + 1; rx < -x0; rx += 2.2) {
    box(group, 0.08, 1.0, 0.08, '#3a3f52', rx, f3Y, -z0 - 0.4, { shadow: false });
  }
  box(group, BLDG_W, 0.08, 0.12, '#3a3f52', 0, f3Y + 1.0, -z0 - 0.4, { shadow: false });
  for (let rz = z0 + 1; rz < -z0; rz += 2.2) {
    box(group, 0.08, 1.0, 0.08, '#3a3f52', -x0 - 0.4, f3Y, rz, { shadow: false });
  }
  box(group, 0.12, 0.08, BLDG_D, '#3a3f52', -x0 - 0.4, f3Y + 1.0, 0, { shadow: false });
  rooms.push({ id: 'kafe', name: 'Kafe Rooftop', labelAnchor: new THREE.Vector3(cafeX, f3Y + 3.8, cafeZ) });

  // ---- Tangga antar lantai (visual, di sudut belakang-kiri) ----
  for (let f = 0; f < 2; f++) {
    const sy = floorY[f];
    for (let s = 0; s < 10; s++) {
      box(group, 3, 0.25, 0.9, '#8a6a44', x0 + 3, sy + (s * FLOOR_H) / 10, z0 + 4 + s * 0.9, { shadow: false });
    }
  }

  // ---- Lampu gantung hangat per lantai (visual saja) ----
  for (let f = 0; f < 3; f++) {
    for (const lx of [-16, 0, 16]) {
      box(group, 0.06, 1.2, 0.06, '#3a3f52', lx, floorY[f] + FLOOR_H - 1.2, 4, { shadow: false });
      const lamp = new THREE.Mesh(unitBox, mat('#ffd9a0'));
      lamp.scale.set(0.5, 0.35, 0.5);
      lamp.position.set(lx, floorY[f] + FLOOR_H - 1.2 + 0.17, 4);
      group.add(lamp);
    }
  }

  return {
    group,
    floorY,
    divisionAreas,
    rooms,
    lobbyAnchor,
    bounds: {
      min: new THREE.Vector3(x0, -1, z0),
      max: new THREE.Vector3(-x0, FLOOR_H * 3 + 2, -z0),
    },
  };
}
