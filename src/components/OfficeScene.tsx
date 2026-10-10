// ============================================================================
// Kantor AI — src/components/OfficeScene.tsx
// 'use client' — canvas Three.js full-size parent.
//
// - Kamera ORTHOGRAPHIC isometrik FIXED (tidak bisa diorbit user)
// - live=true + snapshot segar → MODE LIVE: 1 karakter 3D per agent live,
//   ditempatkan di area divisinya (divisi tak dikenal → lobi)
// - live=false / snapshot kosong / basi → MODE AMBIENT: karakter prosedural
//   abu-abu semi-transparan + badge "AMBIENT" yang berkeliaran.
//   TIDAK PERNAH menampilkan data palsu sebagai live.
// - Cleanup total saat unmount: RAF dibatalkan, listener dilepas, semua
//   geometri/material/tekstur/renderer di-dispose.
// ============================================================================
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  ActivitySnapshot,
  AgentStatus,
  STATUS_COLOR,
  STATUS_LABEL_ID,
  isSnapshotStale,
} from '../lib/types';
import { DIVISIONS } from '../lib/agents-data';
import { buildOffice, divisionColor, OfficeModel } from '../three/office';
import { AgentCharacter } from '../three/characters';
import { LabelManager } from '../three/labels';

interface Props {
  snapshot: ActivitySnapshot;
  live: boolean;
}

/** nama divisi → index DIVISIONS (mapping divisi→ruangan lantai 2) */
const DIV_INDEX = new Map<string, number>(DIVISIONS.map((d, i) => [d.name, i]));

const FRUSTUM_HALF = 28; // setengah tinggi frustum ortho (world units)
const AMBIENT_COUNT = 22;

interface ThreeCtx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  office: OfficeModel;
  labels: LabelManager;
  charGroup: THREE.Group;
  chars: Map<string, AgentCharacter>;
  scratch: Map<string, THREE.Vector3>;
  mode: 'live' | 'ambient' | null;
  raf: number;
  ro: ResizeObserver | null;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/** Slot berdiri di dalam area divisi (depan meja, lalu melingkar bila penuh). */
function divisionSlot(area: { center: THREE.Vector3; size: { w: number; d: number } }, i: number, out: THREE.Vector3): THREE.Vector3 {
  const { center } = area;
  const presets: Array<[number, number]> = [
    [-1.6, 2.4],
    [1.6, 2.4],
    [-3.6, -1.4],
    [3.6, -1.4],
    [-1.6, -3.6],
    [1.6, -3.6],
  ];
  if (i < presets.length) {
    return out.set(center.x + presets[i][0], center.y, center.z + presets[i][1]);
  }
  const a = i * 2.39996; // sudut emas — penyebaran deterministik
  const rx = Math.min(area.size.w / 2 - 1, 2 + (i % 5));
  const rz = Math.min(area.size.d / 2 - 1, 2 + ((i + 2) % 5));
  return out.set(center.x + Math.cos(a) * rx, center.y, center.z + Math.sin(a) * rz);
}

function lobbySlot(anchor: THREE.Vector3, i: number, out: THREE.Vector3): THREE.Vector3 {
  const a = i * 2.39996; // sudut emas — penyebaran deterministik
  const r = 2.2 + (i % 4) * 0.9;
  return out.set(anchor.x + Math.cos(a) * r, anchor.y, anchor.z + Math.sin(a) * r * 0.8);
}

export default function OfficeScene({ snapshot, live }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<ThreeCtx | null>(null);
  const dataRef = useRef({ snapshot, live });
  dataRef.current = { snapshot, live };

  // ------------------------------------------------- init sekali (mount) --
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b0e17');
    scene.fog = new THREE.Fog(0x0b0e17, 170, 360);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    camera.position.set(58, 52, 58);
    camera.lookAt(0, 7, 0);

    // ---------------------------------------------------------- lighting --
    // Hangat: hemisphere lembut + 1 directional dengan shadow (satu-satunya
    // shadow caster — keputusan budget: shadow map 2048, satu pass).
    scene.add(new THREE.HemisphereLight(0xfff1dd, 0x2a2438, 0.85));
    const sun = new THREE.DirectionalLight(0xffe2b0, 1.7);
    sun.position.set(38, 62, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 180;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8fa2ff, 0.28);
    fill.position.set(-40, 30, -30);
    scene.add(fill);

    // tanah di bawah gedung (penangkap bayangan)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshLambertMaterial({ color: '#0d1120' }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.65;
    ground.receiveShadow = true;
    scene.add(ground);

    // ------------------------------------------------------------ gedung --
    const office = buildOffice(DIVISIONS.map((d) => d.name));
    scene.add(office.group);

    const charGroup = new THREE.Group();
    scene.add(charGroup);

    // ------------------------------------------------------------- label --
    const labels = new LabelManager(scene);
    for (const area of office.divisionAreas) {
      const anchor = area.labelAnchor.clone();
      labels.addLabel({
        id: `room-div-${area.index}`,
        text: area.name,
        sub: 'Area Divisi',
        kind: 'room',
        dotColor: area.color,
        getWorldPos: () => anchor,
      });
    }
    for (const room of office.rooms) {
      const anchor = room.labelAnchor.clone();
      labels.addLabel({
        id: `room-${room.id}`,
        text: room.name,
        kind: 'room',
        dotColor: '#8f98bd',
        priority: 12,
        getWorldPos: () => anchor,
      });
    }

    const ctx: ThreeCtx = {
      renderer,
      scene,
      camera,
      office,
      labels,
      charGroup,
      chars: new Map(),
      scratch: new Map(),
      mode: null,
      raf: 0,
      ro: null,
    };
    ctxRef.current = ctx;

    const fit = (): void => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      const aspect = w / h;
      camera.left = -FRUSTUM_HALF * aspect;
      camera.right = FRUSTUM_HALF * aspect;
      camera.top = FRUSTUM_HALF;
      camera.bottom = -FRUSTUM_HALF;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labels.setScreen(w, h, h / (FRUSTUM_HALF * 2));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    ctx.ro = ro;

    // -------------------------------------------------------------- loop --
    const clock = new THREE.Clock();
    const tick = (): void => {
      ctx.raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      ctx.chars.forEach((c) => c.update(dt, t));
      camera.updateMatrixWorld();
      labels.update(camera);
      renderer.render(scene, camera);
    };
    tick();

    // ----------------------------------------------------------- cleanup --
    return () => {
      cancelAnimationFrame(ctx.raf);
      ro.disconnect();
      ctx.chars.forEach((c) => c.dispose());
      ctx.chars.clear();
      labels.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh || (obj as THREE.Sprite).isSprite) {
          const m = obj as THREE.Mesh | THREE.Sprite;
          if ((m as THREE.Mesh).geometry) ((m as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
          const mats = (m.material as THREE.Material | THREE.Material[] | undefined);
          if (Array.isArray(mats)) mats.forEach((x) => x.dispose());
          else if (mats) mats.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      ctxRef.current = null;
    };
  }, []);

  // ------------------------------------------- sinkron data → karakter --
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { snapshot: snap, live: liveProp } = dataRef.current;
    const ambient = !liveProp || isSnapshotStale(snap);

    const clearCharacters = (): void => {
      ctx.chars.forEach((c, id) => {
        c.dispose();
        ctx.labels.removeLabel(`agent-${id}`);
        ctx.scratch.delete(id);
      });
      ctx.chars.clear();
    };

    if (ambient) {
      if (ctx.mode !== 'ambient') {
        clearCharacters();
        ctx.mode = 'ambient';
        const { min, max } = ctx.office.bounds;
        for (let i = 0; i < AMBIENT_COUNT; i++) {
          const c = new AgentCharacter({ name: `ambient-${i}`, shirtColor: '#9aa3b2', ambient: true });
          c.setWanderBounds(
            new THREE.Vector3(min.x + 2, 0, min.z + 2),
            new THREE.Vector3(max.x - 2, 10, max.z - 2),
          );
          const start = new THREE.Vector3(
            min.x + 4 + Math.random() * (max.x - min.x - 8),
            [0, 5, 10][i % 3],
            min.z + 4 + Math.random() * (max.z - min.z - 8),
          );
          c.setHome(start);
          c.snapToHome();
          c.setStatus('idle');
          ctx.charGroup.add(c.group);
          ctx.chars.set(`ambient-${i}`, c);
          // tanpa label nama — hanya badge "AMBIENT" pada karakter
        }
      }
      return;
    }

    // ------------------------------------------------------- MODE LIVE --
    if (ctx.mode !== 'live') {
      clearCharacters();
      ctx.mode = 'live';
    }

    const seen = new Set<string>();
    const perDivision = new Map<number, number>();
    let lobbyCount = 0;
    const tmp = new THREE.Vector3();

    for (const agent of snap.agents) {
      seen.add(agent.id);
      const divIdx = DIV_INDEX.get(agent.division);
      const known = divIdx !== undefined;

      let c = ctx.chars.get(agent.id);
      const isNew = c === undefined;
      if (!c) {
        c = new AgentCharacter({
          name: agent.name,
          shirtColor: known ? divisionColor(divIdx as number) : '#8f98bd',
        });
        // batas wandering untuk status "running": tetap di lantainya
        if (known) {
          const area = ctx.office.divisionAreas[divIdx as number];
          c.setWanderBounds(
            new THREE.Vector3(area.center.x - area.size.w / 2 + 1, area.center.y, area.center.z - area.size.d / 2 + 1),
            new THREE.Vector3(area.center.x + area.size.w / 2 - 1, area.center.y, area.center.z + area.size.d / 2 - 1),
          );
        } else {
          c.setWanderBounds(
            new THREE.Vector3(-14, 0, -2),
            new THREE.Vector3(6, 0, 14),
          );
        }
        ctx.charGroup.add(c.group);
        ctx.chars.set(agent.id, c);
        ctx.scratch.set(agent.id, new THREE.Vector3());
      }

      // posisi slot di area divisi / lobi
      if (known) {
        const idx = divIdx as number;
        const n = perDivision.get(idx) ?? 0;
        perDivision.set(idx, n + 1);
        divisionSlot(ctx.office.divisionAreas[idx], n, tmp);
      } else {
        lobbySlot(ctx.office.lobbyAnchor, lobbyCount++, tmp);
      }
      if (c.getHome().distanceToSquared(tmp) > 0.01) c.setHome(tmp);
      if (isNew) c.snapToHome(); // karakter baru langsung di slotnya
      c.setStatus(agent.status as AgentStatus);

      // label nama + status (Bahasa Indonesia)
      const labelId = `agent-${agent.id}`;
      const sub = agent.detail
        ? `${STATUS_LABEL_ID[agent.status as AgentStatus]} — ${truncate(agent.detail, 30)}`
        : STATUS_LABEL_ID[agent.status as AgentStatus];
      const scratch = ctx.scratch.get(agent.id);
      if (ctx.labels.hasLabel(labelId)) {
        ctx.labels.updateLabel(labelId, {
          text: agent.name,
          sub,
          dotColor: STATUS_COLOR[agent.status as AgentStatus],
        });
      } else {
        const ch = c;
        const sv = scratch as THREE.Vector3;
        ctx.labels.addLabel({
          id: labelId,
          text: agent.name,
          sub,
          kind: 'agent',
          dotColor: STATUS_COLOR[agent.status as AgentStatus],
          getWorldPos: () => ch.labelAnchor(sv),
        });
      }
    }

    // hapus karakter yang sudah tidak ada di snapshot
    // (hapus saat forEach aman untuk Map)
    ctx.chars.forEach((c, id) => {
      if (!seen.has(id)) {
        c.dispose();
        ctx.labels.removeLabel(`agent-${id}`);
        ctx.scratch.delete(id);
        ctx.chars.delete(id);
      }
    });
  }, [snapshot, live]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      aria-label="Gedung kantor AI 3D"
    />
  );
}
