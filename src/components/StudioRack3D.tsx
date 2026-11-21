import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AudioTelemetry,
  CableTone,
  InputJackId,
  JackId,
  OutputJackId,
  PatchCable,
  RackModuleId,
  RackParameters,
  SelectedControlInfo,
} from '../types/studio';

export type CameraPreset = 'three_quarter' | 'front' | 'rear' | 'top_angle' | 'ssl_overview';

interface StudioRack3DProps {
  params: RackParameters;
  cables: PatchCable[];
  telemetryRef: React.MutableRefObject<AudioTelemetry>;
  cameraPreset: CameraPreset;
  cameraPresetNonce: number;
  autoRotate: boolean;
  xRayWalls: boolean;
  abstractRacks: boolean;
  showFractal: boolean;
  pendingJack: OutputJackId | null;
  sourceStatus: {
    isDronePlaying: boolean;
    isMicActive: boolean;
    isFilePlaying: boolean;
    hasLoadedFile: boolean;
  };
  onUpdateParam: (
    moduleId: RackModuleId,
    controlId: string,
    value: number | boolean | string
  ) => void;
  onSelectControl: (info: SelectedControlInfo | null) => void;
  onJackClick: (jackId: JackId) => void;
  onConnectCable: (from: OutputJackId, to: InputJackId, replaceCableId?: string) => void;
  onRemoveCable: (cableId: string) => void;
  onTransportAction: (
    action: 'open_mp3' | 'play_pause' | 'drone' | 'mic' | 'export_wav'
  ) => void;
}

interface KnobBinding {
  kind: 'knob';
  moduleId: RackModuleId;
  controlId: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  getValue: (p: RackParameters) => number;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
}

interface SwitchBinding {
  kind: 'switch';
  moduleId: RackModuleId;
  controlId: string;
  label: string;
  getValue: (p: RackParameters) => boolean;
  leverPivot: THREE.Group;
  ledMat: THREE.MeshStandardMaterial;
  hitMesh: THREE.Mesh;
}

interface PadBinding {
  kind: 'pad';
  moduleId: RackModuleId;
  controlId: string;
  label: string;
  action: 'open_mp3' | 'play_pause' | 'drone' | 'mic' | 'export_wav';
  ledMat: THREE.MeshStandardMaterial;
  activeColor: number;
  idleColor: number;
  hitMesh: THREE.Mesh;
}

interface JackBinding {
  kind: 'jack';
  jackId: JackId;
  direction: 'out' | 'in';
  moduleId: RackModuleId;
  label: string;
  worldAnchorLocal: THREE.Vector3;
  collarMat: THREE.MeshStandardMaterial;
  hitMesh: THREE.Mesh;
}

interface CableHitBinding {
  kind: 'cable';
  cableId: string;
  from: OutputJackId;
  to: InputJackId;
  part: 'tube' | 'plugA' | 'plugB';
}

type InteractiveBinding =
  | KnobBinding
  | SwitchBinding
  | PadBinding
  | JackBinding
  | CableHitBinding;

const RACK_W = 2.44;
const RACK_D = 1.18;
const RACK_H = 4.65;
const CAB1_X = -2.96;
const CAB2_X = 0.0;
const CAB3_X = 2.96;

interface ModuleSpec {
  id: RackModuleId;
  cabinetX: number;
  code: string;
  title: string;
  yCenter: number;
  height: number;
  faceTone: 'slate' | 'steel' | 'charcoal' | 'silver' | 'obsidian';
  accentHex: string;
  accentNum: number;
}

const MODULE_SPECS: ModuleSpec[] = [
  // --- Cabinet I (Left Tower: Analog Source, Tube Amp, Hyper-Compressor, Mastering EQ, 128k Bus) ---
  {
    id: 'player',
    cabinetX: CAB1_X,
    code: 'MP3-01',
    title: 'TRANSPORT & SOURCE DECK',
    yCenter: 4.02,
    height: 0.72,
    faceTone: 'charcoal',
    accentHex: '#f59e0b',
    accentNum: 0xf59e0b,
  },
  {
    id: 'amp',
    cabinetX: CAB1_X,
    code: 'AMP-02',
    title: 'CLASS-A TUBE SCREAM AMP',
    yCenter: 3.22,
    height: 0.74,
    faceTone: 'steel',
    accentHex: '#ea580c',
    accentNum: 0xea580c,
  },
  {
    id: 'compressor',
    cabinetX: CAB1_X,
    code: 'CMP-03',
    title: 'MCLASS HYPER-COMPRESSOR',
    yCenter: 2.38,
    height: 0.80,
    faceTone: 'slate',
    accentHex: '#3b82f6',
    accentNum: 0x3b82f6,
  },
  {
    id: 'eq',
    cabinetX: CAB1_X,
    code: 'EQ-04',
    title: '4-BAND MASTERING EQUALIZER',
    yCenter: 1.54,
    height: 0.74,
    faceTone: 'silver',
    accentHex: '#10b981',
    accentNum: 0x10b981,
  },
  {
    id: 'exporter',
    cabinetX: CAB1_X,
    code: 'EXP-05',
    title: '128K AUDIO I/O MASTER BUS',
    yCenter: 0.72,
    height: 0.74,
    faceTone: 'obsidian',
    accentHex: '#eab308',
    accentNum: 0xeab308,
  },
  // --- Cabinet II (Center Tower: Negative Cancellation, 4-Band Acoustic Space & True-0dB Silence Master) ---
  {
    id: 'phaseNull',
    cabinetX: CAB2_X,
    code: 'INV-06',
    title: 'NEGATIVE PHASE CANCELLATION',
    yCenter: 4.02,
    height: 0.72,
    faceTone: 'obsidian',
    accentHex: '#06b6d4',
    accentNum: 0x06b6d4,
  },
  {
    id: 'acousticSpace',
    cabinetX: CAB2_X,
    code: 'SPC-07',
    title: '4-BAND ACOUSTIC SPACE MATRIX',
    yCenter: 3.22,
    height: 0.74,
    faceTone: 'slate',
    accentHex: '#8b5cf6',
    accentNum: 0x8b5cf6,
  },
  {
    id: 'revAmp',
    cabinetX: CAB2_X,
    code: 'REV-08',
    title: 'REVERSED-FREQ SILENCE AMP',
    yCenter: 2.38,
    height: 0.80,
    faceTone: 'charcoal',
    accentHex: '#10b981',
    accentNum: 0x10b981,
  },
  {
    id: 'negMaster',
    cabinetX: CAB2_X,
    code: 'NCL-09',
    title: 'NEGATIVE CMP / LIMIT / GATE',
    yCenter: 1.54,
    height: 0.74,
    faceTone: 'steel',
    accentHex: '#ec4899',
    accentNum: 0xec4899,
  },
  {
    id: 'zeroDbBus',
    cabinetX: CAB2_X,
    code: 'ZDB-10',
    title: 'TRUE 0dB SILENCE SUMMATION',
    yCenter: 0.72,
    height: 0.74,
    faceTone: 'obsidian',
    accentHex: '#22d3ee',
    accentNum: 0x22d3ee,
  },
  // --- Cabinet III (Right Tower: Luxury Tape, Hall Verb, Exciter, M/S Imager & Champagne Reference) ---
  {
    id: 'tapeSat',
    cabinetX: CAB3_X,
    code: 'TAP-11',
    title: 'ANALOG TAPE & WOW / FLUTTER',
    yCenter: 4.02,
    height: 0.72,
    faceTone: 'charcoal',
    accentHex: '#e8c488',
    accentNum: 0xe8c488,
  },
  {
    id: 'luxuryVerb',
    cabinetX: CAB3_X,
    code: 'LUX-12',
    title: 'AMBIENT LUXURY HALL REVERB',
    yCenter: 3.22,
    height: 0.74,
    faceTone: 'obsidian',
    accentHex: '#fbbf24',
    accentNum: 0xfbbf24,
  },
  {
    id: 'harmonicExciter',
    cabinetX: CAB3_X,
    code: 'EXC-13',
    title: 'AURAL HARMONIC EXCITER & AIR',
    yCenter: 2.38,
    height: 0.80,
    faceTone: 'steel',
    accentHex: '#d97706',
    accentNum: 0xd97706,
  },
  {
    id: 'stereoImager',
    cabinetX: CAB3_X,
    code: 'IMG-14',
    title: 'MID / SIDE STEREO FIELD IMAGER',
    yCenter: 1.54,
    height: 0.74,
    faceTone: 'slate',
    accentHex: '#38bdf8',
    accentNum: 0x38bdf8,
  },
  {
    id: 'luxuryMaster',
    cabinetX: CAB3_X,
    code: 'FIN-15',
    title: 'CHAMPAGNE REFERENCE STAGE',
    yCenter: 0.72,
    height: 0.74,
    faceTone: 'silver',
    accentHex: '#b45309',
    accentNum: 0xd97706,
  },
];

const CABLE_COLORS: Record<CableTone, number> = {
  amber: 0xf59e0b,
  crimson: 0xdc2626,
  cobalt: 0x2563eb,
  emerald: 0x10b981,
  gold: 0xeab308,
  cyan: 0x06b6d4,
  violet: 0x8b5cf6,
  magenta: 0xec4899,
  champagne: 0xe8c488,
  copper: 0xd97706,
  platinum: 0xd4d4d8,
  ivory: 0xf4f4f5,
  graphite: 0x52525b,
  obsidian: 0x27272a,
};

function createBrushedMetalTexture(baseHex: string, streakAlpha: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    const v = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * streakAlpha})`;
    ctx.fillRect(0, y, canvas.width, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createWalnutRailTexture(variant: 'walnut' | 'ebony' | 'champagne'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle =
    variant === 'walnut' ? '#3b2416' : variant === 'champagne' ? '#56422d' : '#161a24';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < canvas.width; x += 2) {
    const shade = 24 + Math.sin(x * 0.14) * 12 + Math.random() * 12;
    if (variant === 'walnut') {
      ctx.fillStyle = `rgba(${Math.round(shade + 26)}, ${Math.round(shade + 8)}, ${Math.round(shade - 6)}, 0.45)`;
    } else if (variant === 'champagne') {
      ctx.fillStyle = `rgba(${Math.round(shade + 68)}, ${Math.round(shade + 50)}, ${Math.round(shade + 24)}, 0.45)`;
    } else {
      ctx.fillStyle = `rgba(${Math.round(shade)}, ${Math.round(shade + 8)}, ${Math.round(shade + 20)}, 0.45)`;
    }
    ctx.fillRect(x, 0, 2, canvas.height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createParquetFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b1410';
  ctx.fillRect(0, 0, 512, 512);

  const plankW = 64;
  const plankH = 128;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * plankW;
      const y = (row * plankH + (col % 2) * (plankH * 0.5)) % 512;
      const tone = 24 + Math.floor(Math.random() * 14);
      ctx.fillStyle = `rgb(${tone + 14}, ${tone + 5}, ${tone})`;
      ctx.fillRect(x + 1, y + 1, plankW - 2, plankH - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, y, plankW, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  return tex;
}

function createFaceplateTexture(
  code: string,
  title: string,
  faceTone: 'slate' | 'steel' | 'charcoal' | 'silver' | 'obsidian',
  accentHex: string,
  dialSpecs: Array<{ xNorm: number; yNorm: number; label: string }>,
  switchSpecs: Array<{ xNorm: number; yNorm: number; label: string }>
): THREE.CanvasTexture {
  const w = 1024;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const bgMap = {
    charcoal: '#1b1d23',
    steel: '#2b2f38',
    slate: '#1e2430',
    silver: '#cfd5dd',
    obsidian: '#15171c',
  };
  const isLight = faceTone === 'silver';
  ctx.fillStyle = bgMap[faceTone];
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 420; i++) {
    const y = Math.random() * h;
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, y, w, 1);
  }

  ctx.fillStyle = accentHex;
  ctx.fillRect(14, 14, 10, h - 28);
  ctx.fillRect(14, 14, w - 28, 4);

  const fg = isLight ? '#0f172a' : '#f4f4f5';
  const muted = isLight ? '#475569' : '#94a3b8';

  ctx.strokeStyle = isLight ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  ctx.fillStyle = accentHex;
  ctx.font = '700 22px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(code, 38, 28);

  ctx.fillStyle = fg;
  ctx.font = '700 16px "DM Sans", sans-serif';
  ctx.fillText(title, 146, 31);

  dialSpecs.forEach((d) => {
    const cx = d.xNorm * w;
    const cy = d.yNorm * h;
    const r = 46;
    for (let t = 0; t <= 10; t++) {
      const ang = Math.PI * 0.75 + (t / 10) * Math.PI * 1.5;
      const r0 = r;
      const r1 = t % 5 === 0 ? r + 10 : r + 5;
      ctx.strokeStyle = t >= 8 ? accentHex : muted;
      ctx.lineWidth = t % 5 === 0 ? 2.6 : 1.8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.stroke();
    }
    ctx.fillStyle = fg;
    ctx.font = '700 14px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, cx, cy + 58);
  });

  switchSpecs.forEach((s) => {
    const cx = s.xNorm * w;
    const cy = s.yNorm * h;
    ctx.fillStyle = fg;
    ctx.font = '700 13px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(s.label, cx, cy + 36);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRearPatchbayTexture(
  code: string,
  accentHex: string,
  jacks: Array<{ xNorm: number; label: string; dir: 'OUT' | 'IN' }>
): THREE.CanvasTexture {
  const w = 1024;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#18191f';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let gx = 40; gx < w; gx += 48) {
    ctx.beginPath();
    ctx.moveTo(gx, 18);
    ctx.lineTo(gx, h - 18);
    ctx.stroke();
  }

  ctx.fillStyle = accentHex;
  ctx.fillRect(20, 18, w - 40, 4);

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 18, w - 40, h - 36);

  ctx.fillStyle = accentHex;
  ctx.font = '700 20px "IBM Plex Mono", monospace';
  ctx.fillText(`${code} // TRI-CABINET PATCHBAY`, 36, 32);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 13px "IBM Plex Mono", monospace';
  ctx.fillText('CLICK CABLE TO UNPLUG · DRAG PLUGS ACROSS CABINETS I · II · III', 36, 58);

  jacks.forEach((j) => {
    const cx = j.xNorm * w;
    const cy = 175;
    const ringColor = j.dir === 'OUT' ? '#ef4444' : '#38bdf8';
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f4f4f5';
    ctx.font = '700 16px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(j.label, cx, cy + 54);

    ctx.fillStyle = ringColor;
    ctx.font = '700 13px "IBM Plex Mono", monospace';
    ctx.fillText(j.dir === 'OUT' ? 'AUDIO OUT ▸' : '◂ AUDIO IN', cx, cy - 58);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.34)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function formatParamValue(val: number, unit: string): string {
  if (unit === 'dB') return `${val >= 0 ? '+' : ''}${val.toFixed(1)} dB`;
  if (unit === 'ms') return `${Math.round(val * 1000)} ms`;
  if (unit === ':1') return `${val.toFixed(1)}:1`;
  if (unit === '%') return `${Math.round(val * 100)}%`;
  if (unit === 'Hz') return `${val.toFixed(0)} Hz`;
  return val.toFixed(2);
}

// --- Zero-GC Dynamic Tubular Cable Mesh Helpers ---
const CABLE_TUBE_SEGS = 28;
const CABLE_RADIAL_SEGS = 8;
const CABLE_NODE_COUNT = 11;

const _tPt = new THREE.Vector3();
const _tTan = new THREE.Vector3();
const _tNorm = new THREE.Vector3();
const _tBinorm = new THREE.Vector3();
const _tUp = new THREE.Vector3(0, 1, 0);
const _tAltUp = new THREE.Vector3(1, 0, 0);
const _tVert = new THREE.Vector3();
const _tNormal = new THREE.Vector3();

function createAimSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 132px "Cinzel", Georgia, serif';
  ctx.fillText('A I M', canvas.width * 0.5, canvas.height * 0.44);

  ctx.shadowBlur = 8;
  ctx.fillStyle = '#d4d4d8';
  ctx.font = '600 22px "IBM Plex Mono", monospace';
  ctx.fillText('ANALOG INTELLIGENCE MASTERING  ·  SSL 9000G STUDIO', canvas.width * 0.5, canvas.height * 0.81);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSslCenterPanelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#252932';
  ctx.fillRect(0, 0, 512, 384);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, 488, 360);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 20px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SSL 9000G MASTER BUS', 256, 44);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 13px "IBM Plex Mono", monospace';
  ctx.fillText('VCA BUS COMPRESSOR · AIM STUDIO', 256, 72);

  // Grid markings
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  for (let y = 110; y <= 330; y += 55) {
    ctx.beginPath();
    ctx.moveTo(32, y);
    ctx.lineTo(480, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDynamicCableGeometry(): THREE.BufferGeometry {
  const ringStride = CABLE_RADIAL_SEGS + 1;
  const vertCount = (CABLE_TUBE_SEGS + 1) * ringStride;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const indices: number[] = [];

  for (let i = 0; i < CABLE_TUBE_SEGS; i++) {
    for (let j = 0; j < CABLE_RADIAL_SEGS; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

function updateDynamicCableGeometry(
  geo: THREE.BufferGeometry,
  curve: THREE.CatmullRomCurve3,
  radius: number
) {
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute;
  const posArr = posAttr.array as Float32Array;
  const normArr = normAttr.array as Float32Array;
  const ringStride = CABLE_RADIAL_SEGS + 1;

  for (let i = 0; i <= CABLE_TUBE_SEGS; i++) {
    const u = i / CABLE_TUBE_SEGS;
    curve.getPoint(u, _tPt);
    curve.getTangent(u, _tTan).normalize();

    const refUp = Math.abs(_tTan.dot(_tUp)) > 0.92 ? _tAltUp : _tUp;
    _tBinorm.crossVectors(_tTan, refUp).normalize();
    _tNorm.crossVectors(_tBinorm, _tTan).normalize();

    for (let j = 0; j <= CABLE_RADIAL_SEGS; j++) {
      const theta = (j / CABLE_RADIAL_SEGS) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      _tNormal
        .set(0, 0, 0)
        .addScaledVector(_tNorm, cosT)
        .addScaledVector(_tBinorm, sinT)
        .normalize();
      _tVert.copy(_tPt).addScaledVector(_tNormal, radius);

      const idx = (i * ringStride + j) * 3;
      posArr[idx] = _tVert.x;
      posArr[idx + 1] = _tVert.y;
      posArr[idx + 2] = _tVert.z;

      normArr[idx] = _tNormal.x;
      normArr[idx + 1] = _tNormal.y;
      normArr[idx + 2] = _tNormal.z;
    }
  }

  posAttr.needsUpdate = true;
  normAttr.needsUpdate = true;
  geo.computeBoundingSphere();
}

export const StudioRack3D: React.FC<StudioRack3DProps> = ({
  params,
  cables,
  telemetryRef,
  cameraPreset,
  cameraPresetNonce,
  autoRotate,
  xRayWalls,
  abstractRacks,
  showFractal,
  pendingJack,
  sourceStatus,
  onUpdateParam,
  onSelectControl,
  onJackClick,
  onConnectCable,
  onRemoveCable,
  onTransportAction,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const paramsRef = useRef<RackParameters>(params);
  const cablesRef = useRef<PatchCable[]>(cables);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const xRayWallsRef = useRef<boolean>(xRayWalls);
  const abstractRacksRef = useRef<boolean>(abstractRacks);
  const showFractalRef = useRef<boolean>(showFractal);
  const cameraPresetRef = useRef<CameraPreset>(cameraPreset);
  const pendingJackRef = useRef<OutputJackId | null>(pendingJack);
  const sourceStatusRef = useRef(sourceStatus);

  const callbacksRef = useRef({
    onUpdateParam,
    onSelectControl,
    onJackClick,
    onConnectCable,
    onRemoveCable,
    onTransportAction,
  });

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    cablesRef.current = cables;
  }, [cables]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    xRayWallsRef.current = xRayWalls;
  }, [xRayWalls]);

  useEffect(() => {
    abstractRacksRef.current = abstractRacks;
  }, [abstractRacks]);

  useEffect(() => {
    showFractalRef.current = showFractal;
  }, [showFractal]);

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
  }, [cameraPreset]);

  useEffect(() => {
    pendingJackRef.current = pendingJack;
  }, [pendingJack]);

  useEffect(() => {
    sourceStatusRef.current = sourceStatus;
  }, [sourceStatus]);

  useEffect(() => {
    callbacksRef.current = {
      onUpdateParam,
      onSelectControl,
      onJackClick,
      onConnectCable,
      onRemoveCable,
      onTransportAction,
    };
  }, [
    onUpdateParam,
    onSelectControl,
    onJackClick,
    onConnectCable,
    onRemoveCable,
    onTransportAction,
  ]);

  const cameraTransitionRef = useRef<{
    active: boolean;
    targetPos: THREE.Vector3;
    targetLook: THREE.Vector3;
  }>({
    active: false,
    targetPos: new THREE.Vector3(5.2, 3.1, 10.2),
    targetLook: new THREE.Vector3(0, 2.35, -1.2),
  });

  useEffect(() => {
    const tr = cameraTransitionRef.current;
    tr.targetLook.set(0, 2.35, -1.0);
    if (cameraPreset === 'front') {
      tr.targetPos.set(0, 2.55, 10.4);
    } else if (cameraPreset === 'rear') {
      tr.targetPos.set(0.2, 2.55, -7.2);
      tr.targetLook.set(0, 2.35, 0);
    } else if (cameraPreset === 'top_angle') {
      tr.targetPos.set(5.4, 5.6, 7.8);
    } else if (cameraPreset === 'ssl_overview') {
      tr.targetPos.set(0, 4.3, 8.2);
      tr.targetLook.set(0, 1.9, -3.5);
    } else {
      tr.targetPos.set(5.2, 3.1, 10.2);
    }
    tr.active = true;
  }, [cameraPreset, cameraPresetNonce]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0b0e);
    scene.fog = new THREE.FogExp2(0x0c0b0e, 0.018);

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 80);
    camera.position.set(4.8, 3.0, 9.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.42, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.8;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();

    controls.addEventListener('start', () => {
      cameraTransitionRef.current.active = false;
    });

    // Warm Luxury Mastering Room Studio Lighting across Tri-Cabinet
    const hemiLight = new THREE.HemisphereLight(0xf6ead8, 0x1e1814, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    keyLight.position.set(6.5, 8.6, 7.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 26;
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x9ec5ff, 1.45);
    rimLight.position.set(-6.0, 5.8, -6.8);
    scene.add(rimLight);

    const rearFillLight = new THREE.PointLight(0xffedd5, 1.7, 16);
    rearFillLight.position.set(0, 2.7, -4.0);
    scene.add(rearFillLight);

    const warmSconceL = new THREE.PointLight(0xf59e0b, 2.2, 11);
    warmSconceL.position.set(-5.8, 3.6, -4.1);
    scene.add(warmSconceL);

    const warmSconceR = new THREE.PointLight(0xf59e0b, 2.2, 11);
    warmSconceR.position.set(5.8, 3.6, -4.1);
    scene.add(warmSconceR);

    // --- Ambient Luxury Studio Space Architecture ---
    const parquetTex = createParquetFloorTexture();
    parquetTex.anisotropy = maxAnisotropy;
    const floorGeo = new THREE.PlaneGeometry(48, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      map: parquetTex,
      roughness: 0.62,
      metalness: 0.08,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const rugGeo = new THREE.BoxGeometry(10.6, 0.024, 3.9);
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0x16171d,
      roughness: 0.92,
      metalness: 0.04,
    });
    const rugMesh = new THREE.Mesh(rugGeo, rugMat);
    rugMesh.position.set(0, 0.012, 0);
    rugMesh.receiveShadow = true;
    scene.add(rugMesh);

    const rugTrimGeo = new THREE.BoxGeometry(10.72, 0.018, 4.02);
    const rugTrimMat = new THREE.MeshStandardMaterial({
      color: 0xb08a4f,
      roughness: 0.35,
      metalness: 0.72,
    });
    const rugTrim = new THREE.Mesh(rugTrimGeo, rugTrimMat);
    rugTrim.position.set(0, 0.008, 0);
    scene.add(rugTrim);

    const contactTex = createContactShadowTexture();
    const contactPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(11.0, 3.2),
      new THREE.MeshBasicMaterial({
        map: contactTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.78,
      })
    );
    contactPlane.rotation.x = -Math.PI / 2;
    contactPlane.position.y = 0.028;
    scene.add(contactPlane);

    // Acoustic Wood-Slat Diffuser Room Shell (Back Wall, Angled Side Wings & Translucent Front Glass Boundary)
    const studioRoomGroup = new THREE.Group();
    scene.add(studioRoomGroup);

    const feltBackingMat = new THREE.MeshStandardMaterial({
      color: 0x111216,
      roughness: 0.96,
      metalness: 0.02,
      transparent: true,
      opacity: 1.0,
    });
    const studioWalnutSlatMat = new THREE.MeshStandardMaterial({
      color: 0x4a2f1d,
      roughness: 0.46,
      metalness: 0.1,
      transparent: true,
      opacity: 1.0,
    });
    const studioBronzeMat = new THREE.MeshStandardMaterial({
      color: 0xb78b4a,
      roughness: 0.28,
      metalness: 0.85,
    });
    const studioLEDStripMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.15,
      roughness: 0.2,
    });
    const xRayWireMat = new THREE.LineBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.0,
    });

    const backWallGeo = new THREE.BoxGeometry(20.5, 7.2, 0.18);
    const backWall = new THREE.Mesh(backWallGeo, feltBackingMat);
    backWall.position.set(0, 3.6, -8.2);
    backWall.receiveShadow = true;
    studioRoomGroup.add(backWall);

    const backWallEdgesGeo = new THREE.EdgesGeometry(backWallGeo);
    const backWallWire = new THREE.LineSegments(backWallEdgesGeo, xRayWireMat);
    backWallWire.position.copy(backWall.position);
    studioRoomGroup.add(backWallWire);

    const wingGeo = new THREE.BoxGeometry(9.5, 7.2, 0.18);
    const wingEdgesGeo = new THREE.EdgesGeometry(wingGeo);
    const leftWing = new THREE.Mesh(wingGeo, feltBackingMat);
    leftWing.position.set(-10.8, 3.6, -4.0);
    leftWing.rotation.y = Math.PI * 0.36;
    studioRoomGroup.add(leftWing);
    const leftWingWire = new THREE.LineSegments(wingEdgesGeo, xRayWireMat);
    leftWingWire.position.copy(leftWing.position);
    leftWingWire.rotation.copy(leftWing.rotation);
    studioRoomGroup.add(leftWingWire);

    const rightWing = new THREE.Mesh(wingGeo, feltBackingMat);
    rightWing.position.set(10.8, 3.6, -4.0);
    rightWing.rotation.y = -Math.PI * 0.36;
    studioRoomGroup.add(rightWing);
    const rightWingWire = new THREE.LineSegments(wingEdgesGeo, xRayWireMat);
    rightWingWire.position.copy(rightWing.position);
    rightWingWire.rotation.copy(rightWing.rotation);
    studioRoomGroup.add(rightWingWire);

    // 72 Instanced Walnut Acoustic Diffuser Slats across rear studio wall
    const slatGeo = new THREE.BoxGeometry(0.11, 6.8, 0.11);
    const slatDummy = new THREE.Object3D();
    const slatMesh = new THREE.InstancedMesh(slatGeo, studioWalnutSlatMat, 72);
    for (let i = 0; i < 72; i++) {
      const u = i / 71;
      const sx = THREE.MathUtils.lerp(-9.6, 9.6, u);
      const sz = -8.04 + Math.cos((u - 0.5) * Math.PI) * 0.16;
      slatDummy.position.set(sx, 3.45, sz);
      slatDummy.updateMatrix();
      slatMesh.setMatrixAt(i, slatDummy.matrix);
    }
    slatMesh.instanceMatrix.needsUpdate = true;
    slatMesh.computeBoundingSphere();
    studioRoomGroup.add(slatMesh);

    // Overhead Acoustic Cloud Canopy with Warm Amber Cove Lighting
    const cloudGeo = new THREE.BoxGeometry(10.8, 0.18, 4.4);
    const cloudMesh = new THREE.Mesh(cloudGeo, feltBackingMat);
    cloudMesh.position.set(0, 5.95, -1.8);
    studioRoomGroup.add(cloudMesh);

    const cloudTrimGeo = new THREE.BoxGeometry(10.94, 0.08, 4.54);
    const cloudTrim = new THREE.Mesh(cloudTrimGeo, studioBronzeMat);
    cloudTrim.position.set(0, 5.88, -1.8);
    studioRoomGroup.add(cloudTrim);

    const coveLedGeo = new THREE.BoxGeometry(9.8, 0.035, 0.08);
    const coveLedFront = new THREE.Mesh(coveLedGeo, studioLEDStripMat);
    coveLedFront.position.set(0, 5.84, 0.35);
    studioRoomGroup.add(coveLedFront);
    const coveLedRear = new THREE.Mesh(coveLedGeo, studioLEDStripMat);
    coveLedRear.position.set(0, 5.84, -3.95);
    studioRoomGroup.add(coveLedRear);

    // --- AIM STUDIO MONOLITH SIGNAGE ON BACK WALL ---
    const aimSignTex = createAimSignTexture();
    aimSignTex.anisotropy = maxAnisotropy;
    const aimSignGeo = new THREE.PlaneGeometry(6.8, 1.7);
    const aimSignMat = new THREE.MeshBasicMaterial({
      map: aimSignTex,
      transparent: true,
      opacity: 0.96,
    });
    const aimSignMesh = new THREE.Mesh(aimSignGeo, aimSignMat);
    aimSignMesh.position.set(0, 5.35, -7.88);
    studioRoomGroup.add(aimSignMesh);

    // --- COMPLETE 3D SSL 9000G STUDIO CONSOLE BEHIND MOUNTED RACKS (z = -4.25) ---
    const sslStudioGroup = new THREE.Group();
    sslStudioGroup.position.set(0, 0, -4.35);
    scene.add(sslStudioGroup);

    const sslSteelMat = new THREE.MeshStandardMaterial({
      color: 0x222630,
      roughness: 0.42,
      metalness: 0.72,
    });
    const sslSurfaceMat = new THREE.MeshStandardMaterial({
      color: 0x2e3440,
      roughness: 0.48,
      metalness: 0.54,
    });
    const sslBolsterMat = new THREE.MeshStandardMaterial({
      color: 0x111216,
      roughness: 0.68,
      metalness: 0.08,
    });
    const sslWalnutMat = new THREE.MeshStandardMaterial({
      color: 0x4b2f1d,
      roughness: 0.44,
      metalness: 0.14,
    });
    const sslCenterTex = createSslCenterPanelTexture();
    sslCenterTex.anisotropy = maxAnisotropy;
    const sslCenterMat = new THREE.MeshStandardMaterial({
      map: sslCenterTex,
      roughness: 0.38,
      metalness: 0.45,
    });

    // Raised SSL Control Platform & Console Tub
    const sslPlinthGeo = new THREE.BoxGeometry(9.6, 0.16, 3.0);
    const sslPlinth = new THREE.Mesh(sslPlinthGeo, sslBolsterMat);
    sslPlinth.position.set(0, 0.08, 0);
    sslPlinth.receiveShadow = true;
    sslStudioGroup.add(sslPlinth);

    const sslLegGeo = new THREE.BoxGeometry(0.28, 1.05, 1.85);
    [-3.7, -1.25, 1.25, 3.7].forEach((lx) => {
      const leg = new THREE.Mesh(sslLegGeo, sslSteelMat);
      leg.position.set(lx, 0.62, 0);
      leg.castShadow = true;
      sslStudioGroup.add(leg);
    });

    const sslTubGeo = new THREE.BoxGeometry(8.8, 0.34, 2.25);
    const sslTub = new THREE.Mesh(sslTubGeo, sslSteelMat);
    sslTub.position.set(0, 1.24, 0);
    sslTub.castShadow = true;
    sslStudioGroup.add(sslTub);

    const sslCheekGeo = new THREE.BoxGeometry(0.16, 0.56, 2.38);
    [-4.48, 4.48].forEach((cxSide) => {
      const cheek = new THREE.Mesh(sslCheekGeo, sslWalnutMat);
      cheek.position.set(cxSide, 1.32, 0.04);
      cheek.castShadow = true;
      sslStudioGroup.add(cheek);
    });

    const sslBolsterGeo = new THREE.BoxGeometry(8.86, 0.16, 0.24);
    const sslBolster = new THREE.Mesh(sslBolsterGeo, sslBolsterMat);
    sslBolster.position.set(0, 1.44, 1.08);
    sslStudioGroup.add(sslBolster);

    const sslDeskPlateGeo = new THREE.BoxGeometry(8.64, 0.08, 1.72);
    const sslDeskPlate = new THREE.Mesh(sslDeskPlateGeo, sslSurfaceMat);
    sslDeskPlate.position.set(0, 1.44, 0.06);
    sslDeskPlate.rotation.x = 0.14;
    sslStudioGroup.add(sslDeskPlate);

    // SSL Meter Bridge + AIM illuminated glass badge
    const sslBridgeGeo = new THREE.BoxGeometry(8.8, 0.64, 0.42);
    const sslBridge = new THREE.Mesh(sslBridgeGeo, sslSteelMat);
    sslBridge.position.set(0, 1.82, -0.82);
    sslBridge.rotation.x = 0.18;
    sslStudioGroup.add(sslBridge);

    const sslCenterPanelGeo = new THREE.PlaneGeometry(1.18, 1.56);
    const sslCenterPanel = new THREE.Mesh(sslCenterPanelGeo, sslCenterMat);
    sslCenterPanel.rotation.x = -Math.PI * 0.5 + 0.14;
    sslCenterPanel.position.set(0, 1.495, 0.06);
    sslStudioGroup.add(sslCenterPanel);

    // Dual SSL Center Bus Compressor VU Meters
    const sslVuFaceMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.75,
      roughness: 0.3,
    });
    const sslVuBoxGeo = new THREE.BoxGeometry(0.38, 0.24, 0.06);
    const sslVuNeedleGeo = new THREE.BoxGeometry(0.012, 0.16, 0.012);
    sslVuNeedleGeo.translate(0, 0.08, 0);
    const sslVuNeedleMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
    const sslVuNeedles: THREE.Group[] = [];
    [-0.24, 0.24].forEach((vx) => {
      const face = new THREE.Mesh(sslVuBoxGeo, sslVuFaceMat);
      face.position.set(vx, 1.86, -0.58);
      sslStudioGroup.add(face);
      const nPivot = new THREE.Group();
      nPivot.position.set(vx, 1.77, -0.54);
      const needle = new THREE.Mesh(sslVuNeedleGeo, sslVuNeedleMat);
      nPivot.add(needle);
      sslStudioGroup.add(nPivot);
      sslVuNeedles.push(nPivot);
    });

    // SSL 32 Channel Strips: Motorized Faders + Color-Coded Pots + Live Meter Bridge LEDs
    const SSL_CHANNELS = 32;
    const sslFaderSlotGeo = new THREE.BoxGeometry(0.032, 0.02, 0.42);
    const sslFaderCapGeo = new THREE.BoxGeometry(0.07, 0.04, 0.065);
    const sslPotGeo = new THREE.CylinderGeometry(0.024, 0.026, 0.035, 10);
    const sslLedColGeo = new THREE.BoxGeometry(0.075, 0.28, 0.03);
    sslLedColGeo.translate(0, 0.14, 0);

    const sslFaderSlots = new THREE.InstancedMesh(sslFaderSlotGeo, sslBolsterMat, SSL_CHANNELS);
    const sslFaderCaps = new THREE.InstancedMesh(sslFaderCapGeo, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.4 }), SSL_CHANNELS);
    const sslPotInstances = new THREE.InstancedMesh(
      sslPotGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.3 }),
      SSL_CHANNELS * 5
    );
    const sslLedBarMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });
    const sslLedInstances = new THREE.InstancedMesh(sslLedColGeo, sslLedBarMat, SSL_CHANNELS);

    const sslDummy = new THREE.Object3D();
    const sslPotColors = [0xef4444, 0x22c55e, 0x3b82f6, 0xf59e0b, 0xe5e7eb];
    const _sslCol = new THREE.Color();
    const sslChPositions: number[] = [];

    let potIdx = 0;
    for (let ch = 0; ch < SSL_CHANNELS; ch++) {
      // Leave gap in center [-0.72 .. +0.72] for SSL Center Bus Compressor Section
      const isRightBay = ch >= 16;
      const bayIndex = isRightBay ? ch - 16 : ch;
      const chX = isRightBay
        ? THREE.MathUtils.lerp(0.86, 4.18, bayIndex / 15)
        : THREE.MathUtils.lerp(-4.18, -0.86, bayIndex / 15);
      sslChPositions.push(chX);

      sslDummy.position.set(chX, 1.43, 0.56);
      sslDummy.rotation.set(0.14, 0, 0);
      sslDummy.scale.set(1, 1, 1);
      sslDummy.updateMatrix();
      sslFaderSlots.setMatrixAt(ch, sslDummy.matrix);

      sslDummy.position.set(chX, 1.46, 0.56);
      sslDummy.updateMatrix();
      sslFaderCaps.setMatrixAt(ch, sslDummy.matrix);

      sslDummy.position.set(chX, 1.66, -0.58);
      sslDummy.rotation.set(0.18, 0, 0);
      sslDummy.updateMatrix();
      sslLedInstances.setMatrixAt(ch, sslDummy.matrix);

      for (let row = 0; row < 5; row++) {
        const pz = THREE.MathUtils.lerp(-0.46, 0.14, row / 4);
        const py = 1.49 - pz * 0.13;
        sslDummy.position.set(chX, py, pz);
        sslDummy.rotation.set(0.14, 0, 0);
        sslDummy.updateMatrix();
        sslPotInstances.setMatrixAt(potIdx, sslDummy.matrix);
        _sslCol.setHex(sslPotColors[row]);
        sslPotInstances.setColorAt(potIdx, _sslCol);
        potIdx++;
      }
    }
    sslFaderSlots.instanceMatrix.needsUpdate = true;
    sslFaderCaps.instanceMatrix.needsUpdate = true;
    sslPotInstances.instanceMatrix.needsUpdate = true;
    if (sslPotInstances.instanceColor) sslPotInstances.instanceColor.needsUpdate = true;
    sslLedInstances.instanceMatrix.needsUpdate = true;
    sslFaderSlots.computeBoundingSphere();
    sslFaderCaps.computeBoundingSphere();
    sslPotInstances.computeBoundingSphere();
    sslLedInstances.computeBoundingSphere();

    sslStudioGroup.add(sslFaderSlots, sslFaderCaps, sslPotInstances, sslLedInstances);

    // SSL Nearfield Bridge Monitors (Left & Right)
    const sslNearCabGeo = new THREE.BoxGeometry(0.46, 0.56, 0.42);
    const sslNearConeGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.04, 18);
    sslNearConeGeo.rotateX(Math.PI / 2);
    [-1.45, 1.45].forEach((nx) => {
      const m = new THREE.Mesh(sslNearCabGeo, sslBolsterMat);
      m.position.set(nx, 2.34, -0.78);
      m.rotation.y = nx < 0 ? 0.25 : -0.25;
      sslStudioGroup.add(m);
      const c = new THREE.Mesh(sslNearConeGeo, studioLEDStripMat);
      c.position.set(nx, 2.30, -0.56);
      c.rotation.y = nx < 0 ? 0.25 : -0.25;
      sslStudioGroup.add(c);
    });

    // --- NEON BLACK & WHITE AUDIO-REACTIVE FRACTAL IN FRONT OF SSL CONSOLE (z = -1.98) ---
    const fractalPortalGroup = new THREE.Group();
    fractalPortalGroup.position.set(0, 3.22, -1.98);
    scene.add(fractalPortalGroup);

    const fractalPlaneGeo = new THREE.PlaneGeometry(8.6, 3.1);
    const fractalUniforms = {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uBeat: { value: 0 },
    };
    const fractalShaderMat = new THREE.ShaderMaterial({
      uniforms: fractalUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uBass;
        uniform float uMid;
        uniform float uTreble;
        uniform float uBeat;

        void main() {
          vec2 uv = (vUv - 0.5) * vec2(2.75, 1.15);
          float r = length(uv);
          float angle = atan(uv.y, uv.x);
          // Kaleidoscopic monochrome fold + Julia fractal iteration
          float sym = 6.0;
          float a = mod(angle, 6.2831853 / sym) - (3.1415926 / sym);
          vec2 z = vec2(cos(a), abs(sin(a))) * r * (1.28 - uBass * 0.22);
          vec2 c = vec2(
            -0.76 + 0.12 * cos(uTime * 0.45 + uMid * 2.5),
             0.18 + 0.14 * sin(uTime * 0.37 - uTreble * 2.0)
          );

          float minTrap = 100.0;
          float esc = 0.0;
          for (int i = 0; i < 24; i++) {
            z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
            float d = dot(z, z);
            minTrap = min(minTrap, abs(length(z) - 0.85));
            if (d > 12.0) {
              esc = float(i) / 24.0;
              break;
            }
          }

          float neonLine = exp(-minTrap * (13.0 - uBeat * 5.0));
          float ringPulse = exp(-abs(r - (0.55 + uBass * 0.18)) * 18.0) * 0.55;
          float grid = smoothstep(0.95, 1.0, cos(z.x * 8.0) * cos(z.y * 8.0)) * 0.35;
          float lum = clamp(neonLine * 1.15 + ringPulse + grid + esc * 0.22, 0.0, 1.0);

          // Crisp soft vignette so black backdrop disappears cleanly over the SSL console
          float edgeMask = smoothstep(1.0, 0.15, max(abs(vUv.x - 0.5) * 2.0, abs(vUv.y - 0.5) * 2.0));
          float finalAlpha = lum * edgeMask * (0.72 + uBeat * 0.28);
          vec3 bw = vec3(lum);
          gl_FragColor = vec4(bw, finalAlpha);
        }
      `,
    });
    const fractalMesh = new THREE.Mesh(fractalPlaneGeo, fractalShaderMat);
    fractalPortalGroup.add(fractalMesh);

    const fractalFrameGeo = new THREE.BoxGeometry(8.78, 0.06, 0.08);
    const fractalNeonWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.4,
      roughness: 0.15,
    });
    const fTopBar = new THREE.Mesh(fractalFrameGeo, fractalNeonWhiteMat);
    fTopBar.position.set(0, 1.56, 0);
    const fBotBar = new THREE.Mesh(fractalFrameGeo, fractalNeonWhiteMat);
    fBotBar.position.set(0, -1.56, 0);
    fractalPortalGroup.add(fTopBar, fBotBar);

    // Compact Neon Monochrome AIM Crest above the Fractal Frame
    const aimCrestGeo = new THREE.PlaneGeometry(2.3, 0.58);
    const aimCrestMesh = new THREE.Mesh(aimCrestGeo, aimSignMat);
    aimCrestMesh.position.set(0, 1.94, 0.02);
    fractalPortalGroup.add(aimCrestMesh);

    // --- MOUNTED RACK GANTRY STANDS (ANCHORING RACKS IN FRONT OF SSL) ---
    const gantryBeamGeo = new THREE.BoxGeometry(9.4, 0.11, 0.22);
    const gantryPostGeo = new THREE.BoxGeometry(0.14, 5.15, 0.22);
    const gantryRearCross = new THREE.Mesh(gantryBeamGeo, sslSteelMat);
    gantryRearCross.position.set(0, 4.92, -0.68);
    scene.add(gantryRearCross);
    [-4.58, -1.48, 1.48, 4.58].forEach((gx) => {
      const post = new THREE.Mesh(gantryPostGeo, sslSteelMat);
      post.position.set(gx, 2.575, -0.68);
      post.castShadow = true;
      scene.add(post);
    });

    // Left & Right 3-Part Reference Studio Monitor Towers
    const monitorStandGeo = new THREE.BoxGeometry(0.54, 2.25, 0.56);
    const monitorCabGeo = new THREE.BoxGeometry(0.86, 1.48, 0.72);
    const monitorBaffleGeo = new THREE.BoxGeometry(0.76, 1.34, 0.04);
    const monitorWooferGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.05, 24);
    monitorWooferGeo.rotateX(Math.PI / 2);
    const monitorTweeterGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.04, 20);
    monitorTweeterGeo.rotateX(Math.PI / 2);
    const monitorWooferMats: THREE.MeshStandardMaterial[] = [];

    [-1, 1].forEach((side) => {
      const mGroup = new THREE.Group();
      mGroup.position.set(side * 5.85, 0, -2.15);
      mGroup.rotation.y = side * -0.34;

      const stand = new THREE.Mesh(monitorStandGeo, feltBackingMat);
      stand.position.y = 1.125;
      stand.castShadow = true;
      mGroup.add(stand);

      const cab = new THREE.Mesh(monitorCabGeo, studioWalnutSlatMat);
      cab.position.y = 2.98;
      cab.castShadow = true;
      mGroup.add(cab);

      const baffle = new THREE.Mesh(
        monitorBaffleGeo,
        feltBackingMat
      );
      baffle.position.set(0, 2.98, 0.36);
      mGroup.add(baffle);

      const wMat = new THREE.MeshStandardMaterial({
        color: 0x20222a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.08,
        roughness: 0.32,
        metalness: 0.65,
      });
      monitorWooferMats.push(wMat);

      const woofer = new THREE.Mesh(monitorWooferGeo, wMat);
      woofer.position.set(0, 2.74, 0.38);
      mGroup.add(woofer);

      const tweeter = new THREE.Mesh(monitorTweeterGeo, studioBronzeMat);
      tweeter.position.set(0, 3.36, 0.38);
      mGroup.add(tweeter);

      studioRoomGroup.add(mGroup);
    });

    // Rear Brass Architectural Floor Sconces
    const sconcePoleGeo = new THREE.CylinderGeometry(0.03, 0.04, 3.6, 12);
    const sconceBowlGeo = new THREE.CylinderGeometry(0.24, 0.08, 0.22, 18);
    [-1, 1].forEach((side) => {
      const pole = new THREE.Mesh(sconcePoleGeo, studioBronzeMat);
      pole.position.set(side * 6.0, 1.8, -7.1);
      studioRoomGroup.add(pole);

      const bowl = new THREE.Mesh(sconceBowlGeo, studioLEDStripMat);
      bowl.position.set(side * 6.0, 3.62, -7.1);
      studioRoomGroup.add(bowl);
    });

    // --- Build Tri-Cabinet 3D Studio Rack Group (Cabinet I, II, III) ---
    const rackGroup = new THREE.Group();
    scene.add(rackGroup);

    const disposables: Array<{ dispose: () => void }> = [
      envTex,
      parquetTex,
      floorGeo,
      floorMat,
      rugGeo,
      rugMat,
      rugTrimGeo,
      rugTrimMat,
      contactTex,
      contactPlane.geometry,
      contactPlane.material as THREE.Material,
      feltBackingMat,
      studioWalnutSlatMat,
      studioBronzeMat,
      studioLEDStripMat,
      xRayWireMat,
      backWallGeo,
      backWallEdgesGeo,
      wingGeo,
      wingEdgesGeo,
      slatGeo,
      cloudGeo,
      cloudTrimGeo,
      coveLedGeo,
      aimSignTex,
      aimSignGeo,
      aimSignMat,
      sslSteelMat,
      sslSurfaceMat,
      sslBolsterMat,
      sslWalnutMat,
      sslCenterTex,
      sslCenterMat,
      sslPlinthGeo,
      sslLegGeo,
      sslTubGeo,
      sslCheekGeo,
      sslBolsterGeo,
      sslDeskPlateGeo,
      sslBridgeGeo,
      sslCenterPanelGeo,
      sslVuFaceMat,
      sslVuBoxGeo,
      sslVuNeedleGeo,
      sslVuNeedleMat,
      sslFaderSlotGeo,
      sslFaderCapGeo,
      sslPotGeo,
      sslLedColGeo,
      sslFaderCaps.material as THREE.Material,
      sslPotInstances.material as THREE.Material,
      sslLedBarMat,
      sslNearCabGeo,
      sslNearConeGeo,
      fractalPlaneGeo,
      fractalShaderMat,
      fractalFrameGeo,
      fractalNeonWhiteMat,
      aimCrestGeo,
      gantryBeamGeo,
      gantryPostGeo,
      monitorStandGeo,
      monitorCabGeo,
      monitorBaffleGeo,
      monitorWooferGeo,
      monitorTweeterGeo,
      ...monitorWooferMats,
      sconcePoleGeo,
      sconceBowlGeo,
    ];

    const brushedDarkTex = createBrushedMetalTexture('#1a1c22', 0.07);
    brushedDarkTex.anisotropy = maxAnisotropy;
    const walnutTex = createWalnutRailTexture('walnut');
    walnutTex.anisotropy = maxAnisotropy;
    const ebonyTex = createWalnutRailTexture('ebony');
    ebonyTex.anisotropy = maxAnisotropy;
    const champagneTex = createWalnutRailTexture('champagne');
    champagneTex.anisotropy = maxAnisotropy;
    disposables.push(brushedDarkTex, walnutTex, ebonyTex, champagneTex);

    const sideCheekCab1Mat = new THREE.MeshStandardMaterial({
      map: walnutTex,
      roughness: 0.42,
      metalness: 0.12,
      transparent: true,
      opacity: 1.0,
    });
    const sideCheekCab2Mat = new THREE.MeshStandardMaterial({
      map: ebonyTex,
      roughness: 0.36,
      metalness: 0.28,
      transparent: true,
      opacity: 1.0,
    });
    const sideCheekCab3Mat = new THREE.MeshStandardMaterial({
      map: champagneTex,
      roughness: 0.34,
      metalness: 0.38,
      transparent: true,
      opacity: 1.0,
    });
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c22,
      map: brushedDarkTex,
      roughness: 0.52,
      metalness: 0.68,
      transparent: true,
      opacity: 1.0,
    });
    const trimRailMat = new THREE.MeshStandardMaterial({
      color: 0x333842,
      roughness: 0.34,
      metalness: 0.86,
      transparent: true,
      opacity: 1.0,
    });
    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      roughness: 0.14,
      metalness: 0.96,
      clearcoat: 0.6,
    });
    const brassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      roughness: 0.22,
      metalness: 0.92,
      clearcoat: 0.5,
    });
    const knobBlackMat = new THREE.MeshStandardMaterial({
      color: 0x16181d,
      roughness: 0.36,
      metalness: 0.7,
    });
    const pointerAmberMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const pointerWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    disposables.push(
      sideCheekCab1Mat,
      sideCheekCab2Mat,
      sideCheekCab3Mat,
      chassisMat,
      trimRailMat,
      chromeMat,
      brassMat,
      knobBlackMat,
      pointerAmberMat,
      pointerWhiteMat
    );

    const sideGeo = new THREE.BoxGeometry(0.12, RACK_H, RACK_D);
    const plinthGeo = new THREE.BoxGeometry(RACK_W + 0.24, 0.14, RACK_D + 0.04);
    const footGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.07, 16);
    const railGeo = new THREE.BoxGeometry(0.08, RACK_H - 0.2, 0.04);
    const chassisOcclusionMeshes: THREE.Mesh[] = [];

    [
      { cabX: CAB1_X, cheekMat: sideCheekCab1Mat },
      { cabX: CAB2_X, cheekMat: sideCheekCab2Mat },
      { cabX: CAB3_X, cheekMat: sideCheekCab3Mat },
    ].forEach(({ cabX, cheekMat }) => {
      const leftSide = new THREE.Mesh(sideGeo, cheekMat);
      leftSide.position.set(cabX - RACK_W / 2 - 0.06, RACK_H / 2 + 0.08, 0);
      leftSide.castShadow = true;
      leftSide.receiveShadow = true;
      rackGroup.add(leftSide);

      const rightSide = new THREE.Mesh(sideGeo, cheekMat);
      rightSide.position.set(cabX + RACK_W / 2 + 0.06, RACK_H / 2 + 0.08, 0);
      rightSide.castShadow = true;
      rightSide.receiveShadow = true;
      rackGroup.add(rightSide);

      const bottomPlinth = new THREE.Mesh(plinthGeo, trimRailMat);
      bottomPlinth.position.set(cabX, 0.14, 0);
      bottomPlinth.castShadow = true;
      bottomPlinth.receiveShadow = true;
      rackGroup.add(bottomPlinth);

      const topPlinth = new THREE.Mesh(plinthGeo, trimRailMat);
      topPlinth.position.set(cabX, RACK_H + 0.04, 0);
      topPlinth.castShadow = true;
      rackGroup.add(topPlinth);

      chassisOcclusionMeshes.push(leftSide, rightSide, bottomPlinth, topPlinth);

      [
        [cabX - RACK_W / 2 + 0.05, 0.035, RACK_D / 2 - 0.12],
        [cabX + RACK_W / 2 - 0.05, 0.035, RACK_D / 2 - 0.12],
        [cabX - RACK_W / 2 + 0.05, 0.035, -RACK_D / 2 + 0.12],
        [cabX + RACK_W / 2 - 0.05, 0.035, -RACK_D / 2 + 0.12],
      ].forEach(([fx, fy, fz]) => {
        const f = new THREE.Mesh(footGeo, knobBlackMat);
        f.position.set(fx, fy, fz);
        rackGroup.add(f);
      });

      [-1, 1].forEach((side) => {
        const frontRail = new THREE.Mesh(railGeo, trimRailMat);
        frontRail.position.set(
          cabX + side * (RACK_W / 2 - 0.04),
          RACK_H / 2 + 0.08,
          RACK_D / 2 - 0.02
        );
        rackGroup.add(frontRail);

        const rearRail = new THREE.Mesh(railGeo, trimRailMat);
        rearRail.position.set(
          cabX + side * (RACK_W / 2 - 0.04),
          RACK_H / 2 + 0.08,
          -RACK_D / 2 + 0.02
        );
        rackGroup.add(rearRail);
      });
    });

    // Instanced Rack Screws (80 across both cabinets)
    const screwGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.025, 6);
    screwGeo.rotateX(Math.PI / 2);
    const screwInstances = new THREE.InstancedMesh(screwGeo, chromeMat, MODULE_SPECS.length * 8);
    const dummy = new THREE.Object3D();
    let sIdx = 0;
    MODULE_SPECS.forEach((mod) => {
      const dy = mod.height * 0.34;
      [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sy) => {
          dummy.position.set(
            mod.cabinetX + sx * (RACK_W / 2 - 0.06),
            mod.yCenter + sy * dy,
            RACK_D / 2 + 0.025
          );
          dummy.updateMatrix();
          screwInstances.setMatrixAt(sIdx++, dummy.matrix);

          dummy.position.set(
            mod.cabinetX + sx * (RACK_W / 2 - 0.06),
            mod.yCenter + sy * dy,
            -RACK_D / 2 - 0.025
          );
          dummy.updateMatrix();
          screwInstances.setMatrixAt(sIdx++, dummy.matrix);
        });
      });
    });
    screwInstances.instanceMatrix.needsUpdate = true;
    screwInstances.computeBoundingSphere();
    rackGroup.add(screwInstances);

    disposables.push(sideGeo, plinthGeo, footGeo, railGeo, screwGeo);

    const interactives: InteractiveBinding[] = [];
    const hitMeshes: THREE.Mesh[] = [];

    const sharedKnobGeo = new THREE.CylinderGeometry(0.056, 0.062, 0.052, 24);
    sharedKnobGeo.rotateX(Math.PI / 2);
    const sharedKnobCapGeo = new THREE.CylinderGeometry(0.044, 0.048, 0.016, 24);
    sharedKnobCapGeo.rotateX(Math.PI / 2);
    const sharedKnobPointerGeo = new THREE.BoxGeometry(0.009, 0.036, 0.012);
    const sharedKnobHitGeo = new THREE.CylinderGeometry(0.088, 0.088, 0.09, 12);
    sharedKnobHitGeo.rotateX(Math.PI / 2);
    const sharedRingGeo = new THREE.RingGeometry(0.065, 0.076, 24);
    const invisibleHitMat = new THREE.MeshBasicMaterial({ visible: false });

    const sharedSwitchBaseGeo = new THREE.CylinderGeometry(0.024, 0.028, 0.02, 8);
    sharedSwitchBaseGeo.rotateX(Math.PI / 2);
    const sharedSwitchBatGeo = new THREE.CylinderGeometry(0.007, 0.012, 0.065, 10);
    sharedSwitchBatGeo.translate(0, 0.032, 0);
    const sharedSwitchHitGeo = new THREE.BoxGeometry(0.11, 0.13, 0.12);
    const sharedLedGeo = new THREE.SphereGeometry(0.014, 10, 10);

    const sharedPadGeo = new THREE.BoxGeometry(0.13, 0.068, 0.032);
    const sharedJackSleeveGeo = new THREE.CylinderGeometry(0.039, 0.044, 0.038, 16);
    sharedJackSleeveGeo.rotateX(Math.PI / 2);
    const sharedJackHoleGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.042, 12);
    sharedJackHoleGeo.rotateX(Math.PI / 2);
    const sharedJackHitGeo = new THREE.CylinderGeometry(0.092, 0.092, 0.12, 12);
    sharedJackHitGeo.rotateX(Math.PI / 2);

    disposables.push(
      sharedKnobGeo,
      sharedKnobCapGeo,
      sharedKnobPointerGeo,
      sharedKnobHitGeo,
      sharedRingGeo,
      invisibleHitMat,
      sharedSwitchBaseGeo,
      sharedSwitchBatGeo,
      sharedSwitchHitGeo,
      sharedLedGeo,
      sharedPadGeo,
      sharedJackSleeveGeo,
      sharedJackHoleGeo,
      sharedJackHitGeo
    );

    const frontZ = RACK_D / 2 + 0.015;
    const rearZ = -RACK_D / 2 - 0.015;
    const panelW = RACK_W - 0.18;

    function addKnob(
      cabinetX: number,
      moduleId: RackModuleId,
      yCenter: number,
      modH: number,
      xNorm: number,
      yNorm: number,
      accentNum: number,
      isSilver: boolean,
      controlId: string,
      label: string,
      min: number,
      max: number,
      step: number,
      unit: string,
      getValue: (p: RackParameters) => number
    ) {
      const x = cabinetX + (xNorm - 0.5) * panelW;
      const y = yCenter + (0.5 - yNorm) * modH;

      const knobGroup = new THREE.Group();
      knobGroup.position.set(x, y, frontZ + 0.028);

      const body = new THREE.Mesh(sharedKnobGeo, isSilver ? knobBlackMat : chromeMat);
      body.castShadow = true;
      knobGroup.add(body);

      const capMat = new THREE.MeshStandardMaterial({
        color: isSilver ? accentNum : 0x181b22,
        roughness: 0.35,
        metalness: 0.55,
      });
      disposables.push(capMat);
      const cap = new THREE.Mesh(sharedKnobCapGeo, capMat);
      cap.position.z = 0.028;
      knobGroup.add(cap);

      const ptr = new THREE.Mesh(
        sharedKnobPointerGeo,
        isSilver ? pointerWhiteMat : pointerAmberMat
      );
      ptr.position.set(0, 0.02, 0.036);
      knobGroup.add(ptr);

      const ringMat = new THREE.MeshBasicMaterial({
        color: accentNum,
        transparent: true,
        opacity: 0.25,
      });
      disposables.push(ringMat);
      const ringMesh = new THREE.Mesh(sharedRingGeo, ringMat);
      ringMesh.position.set(x, y, frontZ + 0.004);
      rackGroup.add(ringMesh);

      const hitMesh = new THREE.Mesh(sharedKnobHitGeo, invisibleHitMat);
      hitMesh.position.set(x, y, frontZ + 0.04);
      rackGroup.add(hitMesh);
      rackGroup.add(knobGroup);

      const binding: KnobBinding = {
        kind: 'knob',
        moduleId,
        controlId,
        label,
        min,
        max,
        step,
        unit,
        getValue,
        group: knobGroup,
        hitMesh,
        ringMesh,
      };
      hitMesh.userData.binding = binding;
      interactives.push(binding);
      hitMeshes.push(hitMesh);
    }

    function addSwitch(
      cabinetX: number,
      moduleId: RackModuleId,
      yCenter: number,
      modH: number,
      xNorm: number,
      yNorm: number,
      accentNum: number,
      controlId: string,
      label: string,
      getValue: (p: RackParameters) => boolean
    ) {
      const x = cabinetX + (xNorm - 0.5) * panelW;
      const y = yCenter + (0.5 - yNorm) * modH;

      const base = new THREE.Mesh(sharedSwitchBaseGeo, chromeMat);
      base.position.set(x, y, frontZ + 0.01);
      rackGroup.add(base);

      const leverPivot = new THREE.Group();
      leverPivot.position.set(x, y, frontZ + 0.018);
      leverPivot.rotation.x = Math.PI / 2 - 0.42;
      const bat = new THREE.Mesh(sharedSwitchBatGeo, chromeMat);
      bat.castShadow = true;
      leverPivot.add(bat);
      rackGroup.add(leverPivot);

      const ledMat = new THREE.MeshStandardMaterial({
        color: accentNum,
        emissive: accentNum,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      });
      disposables.push(ledMat);
      const led = new THREE.Mesh(sharedLedGeo, ledMat);
      led.position.set(x, y + 0.055, frontZ + 0.008);
      rackGroup.add(led);

      const hitMesh = new THREE.Mesh(sharedSwitchHitGeo, invisibleHitMat);
      hitMesh.position.set(x, y, frontZ + 0.04);
      rackGroup.add(hitMesh);

      const binding: SwitchBinding = {
        kind: 'switch',
        moduleId,
        controlId,
        label,
        getValue,
        leverPivot,
        ledMat,
        hitMesh,
      };
      hitMesh.userData.binding = binding;
      interactives.push(binding);
      hitMeshes.push(hitMesh);
    }

    function addPad(
      cabinetX: number,
      moduleId: RackModuleId,
      yCenter: number,
      modH: number,
      xNorm: number,
      yNorm: number,
      controlId: string,
      label: string,
      action: PadBinding['action'],
      activeColor: number,
      idleColor = 0x3f4451
    ) {
      const x = cabinetX + (xNorm - 0.5) * panelW;
      const y = yCenter + (0.5 - yNorm) * modH;

      const ledMat = new THREE.MeshStandardMaterial({
        color: idleColor,
        emissive: activeColor,
        emissiveIntensity: 0.16,
        roughness: 0.28,
        metalness: 0.25,
      });
      disposables.push(ledMat);

      const pad = new THREE.Mesh(sharedPadGeo, ledMat);
      pad.position.set(x, y, frontZ + 0.016);
      pad.castShadow = true;
      rackGroup.add(pad);

      const binding: PadBinding = {
        kind: 'pad',
        moduleId,
        controlId,
        label,
        action,
        ledMat,
        activeColor,
        idleColor,
        hitMesh: pad,
      };
      pad.userData.binding = binding;
      interactives.push(binding);
      hitMeshes.push(pad);
    }

    const jackMap = new Map<JackId, JackBinding>();
    function addJack(
      cabinetX: number,
      moduleId: RackModuleId,
      yCenter: number,
      xNorm: number,
      jackId: JackId,
      direction: 'out' | 'in',
      label: string
    ) {
      const x = cabinetX + (xNorm - 0.5) * panelW;
      const y = yCenter - 0.03;

      const baseColor = direction === 'out' ? 0xf87171 : 0x38bdf8;
      const collarMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: direction === 'out' ? 0xef4444 : 0x38bdf8,
        emissiveIntensity: 0.08,
        roughness: 0.22,
        metalness: 0.85,
      });
      disposables.push(collarMat);

      const sleeve = new THREE.Mesh(sharedJackSleeveGeo, collarMat);
      sleeve.position.set(x, y, rearZ - 0.018);
      rackGroup.add(sleeve);

      const hole = new THREE.Mesh(sharedJackHoleGeo, knobBlackMat);
      hole.position.set(x, y, rearZ - 0.022);
      rackGroup.add(hole);

      const hitMesh = new THREE.Mesh(sharedJackHitGeo, invisibleHitMat);
      hitMesh.position.set(x, y, rearZ - 0.042);
      rackGroup.add(hitMesh);

      const binding: JackBinding = {
        kind: 'jack',
        jackId,
        direction,
        moduleId,
        label,
        worldAnchorLocal: new THREE.Vector3(x, y, rearZ - 0.052),
        collarMat,
        hitMesh,
      };
      hitMesh.userData.binding = binding;
      jackMap.set(jackId, binding);
      interactives.push(binding);
      hitMeshes.push(hitMesh);
    }

    // --- Live Meters & Dynamic Visuals inside 3D Faceplates ---
    // Cabinet I Meters
    let ampVuNeedlePivot: THREE.Group | null = null;
    let tubeGlowMat: THREE.MeshStandardMaterial | null = null;
    const cmpLadderMats: Array<{ mat: THREE.MeshStandardMaterial; color: number }> = [];
    const expMeterMats: Array<{ mat: THREE.MeshStandardMaterial; color: number }> = [];
    let oledBarsGroup: THREE.Group | null = null;
    const oledBarMeshes: THREE.Mesh[] = [];

    // Cabinet II Meters
    const nullBarMeshes: THREE.Mesh[] = [];
    const spcBandMeshes: THREE.Mesh[] = [];
    let revVuNeedlePivot: THREE.Group | null = null;
    let cryoTubeGlowMat: THREE.MeshStandardMaterial | null = null;
    const nclLadderMats: Array<{ mat: THREE.MeshStandardMaterial; color: number }> = [];
    const zdbMeterMats: Array<{ mat: THREE.MeshStandardMaterial; color: number }> = [];

    // Cabinet III Meters & Animated Reels
    let tapeReelLeft: THREE.Group | null = null;
    let tapeReelRight: THREE.Group | null = null;
    const luxBarMeshes: THREE.Mesh[] = [];
    let excTubeGlowMat: THREE.MeshStandardMaterial | null = null;
    const imgCorrMats: Array<{ mat: THREE.MeshStandardMaterial; color: number }> = [];
    const finMeterMats: Array<{ mat: THREE.MeshStandardMaterial; color: number }> = [];

    MODULE_SPECS.forEach((spec) => {
      const isSilver = spec.faceTone === 'silver';
      const cx = spec.cabinetX;

      const boxGeo = new THREE.BoxGeometry(panelW, spec.height, RACK_D - 0.04);
      const boxMesh = new THREE.Mesh(boxGeo, chassisMat);
      boxMesh.position.set(cx, spec.yCenter, 0);
      boxMesh.castShadow = true;
      boxMesh.receiveShadow = true;
      rackGroup.add(boxMesh);
      chassisOcclusionMeshes.push(boxMesh);
      disposables.push(boxGeo);

      let dialMeta: Array<{ xNorm: number; yNorm: number; label: string }> = [];
      let switchMeta: Array<{ xNorm: number; yNorm: number; label: string }> = [];
      let rearMeta: Array<{ xNorm: number; label: string; dir: 'OUT' | 'IN' }> = [];

      if (spec.id === 'player') {
        dialMeta = [{ xNorm: 0.77, yNorm: 0.56, label: 'TRIM' }];
        switchMeta = [
          { xNorm: 0.90, yNorm: 0.54, label: 'LOOP' },
          { xNorm: 0.09, yNorm: 0.58, label: 'OPEN MP3' },
          { xNorm: 0.19, yNorm: 0.58, label: 'PLAY' },
          { xNorm: 0.29, yNorm: 0.58, label: '432Hz' },
          { xNorm: 0.39, yNorm: 0.58, label: 'MIC' },
        ];
        rearMeta = [{ xNorm: 0.78, label: 'PLAYER OUT', dir: 'OUT' }];

        addPad(cx, 'player', spec.yCenter, spec.height, 0.09, 0.54, 'openMp3Pad', 'Open MP3 / Audio', 'open_mp3', 0xf59e0b, 0x78350f);
        addPad(cx, 'player', spec.yCenter, spec.height, 0.19, 0.54, 'playPad', 'Play / Pause MP3', 'play_pause', 0x22c55e);
        addPad(cx, 'player', spec.yCenter, spec.height, 0.29, 0.54, 'dronePad', '432Hz Drone', 'drone', 0x38bdf8);
        addPad(cx, 'player', spec.yCenter, spec.height, 0.39, 0.54, 'micPad', 'Live Mic', 'mic', 0xef4444);
        addKnob(cx, 'player', spec.yCenter, spec.height, 0.77, 0.56, spec.accentNum, isSilver, 'inputTrim', 'Input Trim', 0.2, 2.0, 0.02, 'x', (p) => p.player.inputTrim);
        addSwitch(cx, 'player', spec.yCenter, spec.height, 0.90, 0.54, spec.accentNum, 'loop', 'Track Loop', (p) => p.player.loop);
        addJack(cx, 'player', spec.yCenter, 0.78, 'player_out', 'out', 'Player Output');

        oledBarsGroup = new THREE.Group();
        oledBarsGroup.position.set(cx + 0.16, spec.yCenter - 0.02, frontZ + 0.008);
        const bgGeo = new THREE.PlaneGeometry(0.42, 0.22);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x0c0904 });
        oledBarsGroup.add(new THREE.Mesh(bgGeo, bgMat));
        const barGeo = new THREE.BoxGeometry(0.015, 0.16, 0.008);
        disposables.push(bgGeo, bgMat, barGeo);
        for (let b = 0; b < 16; b++) {
          const barColor = b > 12 ? 0xf97316 : b > 8 ? 0xfbbf24 : 0x38bdf8;
          const barMat = new THREE.MeshBasicMaterial({ color: barColor });
          disposables.push(barMat);
          const bm = new THREE.Mesh(barGeo, barMat);
          bm.position.set(-0.18 + b * 0.024, -0.06, 0.004);
          oledBarsGroup.add(bm);
          oledBarMeshes.push(bm);
        }
        rackGroup.add(oledBarsGroup);
      } else if (spec.id === 'amp') {
        dialMeta = [
          { xNorm: 0.22, yNorm: 0.56, label: 'DRIVE' },
          { xNorm: 0.37, yNorm: 0.56, label: 'BIAS' },
          { xNorm: 0.52, yNorm: 0.56, label: 'OUTPUT' },
        ];
        switchMeta = [
          { xNorm: 0.09, yNorm: 0.54, label: 'POWER' },
          { xNorm: 0.65, yNorm: 0.54, label: 'HPF 75Hz' },
        ];
        rearMeta = [
          { xNorm: 0.25, label: 'AMP IN', dir: 'IN' },
          { xNorm: 0.75, label: 'AMP OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'amp', spec.yCenter, spec.height, 0.09, 0.54, spec.accentNum, 'power', 'Amp Power', (p) => p.amp.power);
        addKnob(cx, 'amp', spec.yCenter, spec.height, 0.22, 0.56, spec.accentNum, isSilver, 'drive', 'Tube Drive', 0, 1, 0.01, '%', (p) => p.amp.drive);
        addKnob(cx, 'amp', spec.yCenter, spec.height, 0.37, 0.56, spec.accentNum, isSilver, 'bias', 'Tube Bias', -0.5, 0.5, 0.01, '', (p) => p.amp.bias);
        addKnob(cx, 'amp', spec.yCenter, spec.height, 0.52, 0.56, spec.accentNum, isSilver, 'outputGain', 'Amp Output', 0.2, 2.0, 0.02, 'x', (p) => p.amp.outputGain);
        addSwitch(cx, 'amp', spec.yCenter, spec.height, 0.65, 0.54, spec.accentNum, 'hpfEnabled', '75Hz HPF', (p) => p.amp.hpfEnabled);
        addJack(cx, 'amp', spec.yCenter, 0.25, 'amp_in', 'in', 'Amp Input');
        addJack(cx, 'amp', spec.yCenter, 0.75, 'amp_out', 'out', 'Amp Output');

        const vuFrameGeo = new THREE.BoxGeometry(0.42, 0.30, 0.024);
        const vuBackMat = new THREE.MeshStandardMaterial({
          color: 0xfef3c7,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.18,
          roughness: 0.48,
        });
        const vuFrame = new THREE.Mesh(vuFrameGeo, vuBackMat);
        vuFrame.position.set(cx + 0.69, spec.yCenter - 0.02, frontZ + 0.008);
        rackGroup.add(vuFrame);

        ampVuNeedlePivot = new THREE.Group();
        ampVuNeedlePivot.position.set(cx + 0.69, spec.yCenter - 0.12, frontZ + 0.025);
        const needleGeo = new THREE.BoxGeometry(0.008, 0.21, 0.005);
        needleGeo.translate(0, 0.105, 0);
        const needleMat = new THREE.MeshBasicMaterial({ color: 0xb91c1c });
        ampVuNeedlePivot.add(new THREE.Mesh(needleGeo, needleMat));
        rackGroup.add(ampVuNeedlePivot);

        const tubeGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.13, 14);
        tubeGlowMat = new THREE.MeshStandardMaterial({
          color: 0xfdba74,
          emissive: 0xf97316,
          emissiveIntensity: 0.8,
          roughness: 0.15,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeGlowMat);
        tubeMesh.position.set(cx + 0.95, spec.yCenter - 0.02, frontZ + 0.02);
        rackGroup.add(tubeMesh);

        disposables.push(vuFrameGeo, vuBackMat, needleGeo, needleMat, tubeGeo, tubeGlowMat);
      } else if (spec.id === 'compressor') {
        dialMeta = [
          { xNorm: 0.20, yNorm: 0.56, label: 'THRESH' },
          { xNorm: 0.33, yNorm: 0.56, label: 'RATIO' },
          { xNorm: 0.46, yNorm: 0.56, label: 'MAKEUP' },
          { xNorm: 0.60, yNorm: 0.56, label: 'GAP COND' },
          { xNorm: 0.74, yNorm: 0.56, label: 'WAVE RND' },
        ];
        switchMeta = [
          { xNorm: 0.08, yNorm: 0.54, label: 'CMP ON' },
          { xNorm: 0.87, yNorm: 0.54, label: 'HYPER' },
        ];
        rearMeta = [
          { xNorm: 0.28, label: 'CMP IN', dir: 'IN' },
          { xNorm: 0.72, label: 'CMP OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'compressor', spec.yCenter, spec.height, 0.08, 0.54, spec.accentNum, 'power', 'Compressor Power', (p) => p.compressor.power);
        addKnob(cx, 'compressor', spec.yCenter, spec.height, 0.20, 0.56, spec.accentNum, isSilver, 'threshold', 'Threshold', -48, 0, 1, 'dB', (p) => p.compressor.threshold);
        addKnob(cx, 'compressor', spec.yCenter, spec.height, 0.33, 0.56, spec.accentNum, isSilver, 'ratio', 'Ratio', 1, 20, 0.5, ':1', (p) => p.compressor.ratio);
        addKnob(cx, 'compressor', spec.yCenter, spec.height, 0.46, 0.56, spec.accentNum, isSilver, 'makeupGain', 'Makeup Gain', 0.5, 2.5, 0.05, 'x', (p) => p.compressor.makeupGain);
        addKnob(cx, 'compressor', spec.yCenter, spec.height, 0.60, 0.56, spec.accentNum, isSilver, 'gapCondenseMaster', 'Gap Condense', 0, 1, 0.02, '%', (p) => (p.compressor.s1Condense + p.compressor.s2Condense + p.compressor.s3Condense) / 3);
        addKnob(cx, 'compressor', spec.yCenter, spec.height, 0.74, 0.56, spec.accentNum, isSilver, 'waveRoundMaster', 'Wave Round', 0, 1, 0.02, '%', (p) => (p.compressor.s1Round + p.compressor.s2Round + p.compressor.s3Round + p.compressor.s4SpliceRound) / 4);
        addSwitch(cx, 'compressor', spec.yCenter, spec.height, 0.87, 0.54, spec.accentNum, 'hyperEnabled', 'Hyper-Gap DSP', (p) => p.compressor.hyperEnabled);

        addJack(cx, 'compressor', spec.yCenter, 0.28, 'cmp_in', 'in', 'Compressor Input');
        addJack(cx, 'compressor', spec.yCenter, 0.72, 'cmp_out', 'out', 'Compressor Output');

        const ledBarGeo = new THREE.BoxGeometry(0.028, 0.019, 0.012);
        disposables.push(ledBarGeo);
        for (let i = 0; i < 8; i++) {
          const ledCol = i >= 6 ? 0xef4444 : i >= 4 ? 0xf59e0b : 0x38bdf8;
          const lm = new THREE.MeshStandardMaterial({
            color: ledCol,
            emissive: ledCol,
            emissiveIntensity: 0.1,
          });
          disposables.push(lm);
          cmpLadderMats.push({ mat: lm, color: ledCol });
          const lMesh = new THREE.Mesh(ledBarGeo, lm);
          lMesh.position.set(cx + 0.95, spec.yCenter - 0.18 + i * 0.045, frontZ + 0.01);
          rackGroup.add(lMesh);
        }
      } else if (spec.id === 'eq') {
        dialMeta = [
          { xNorm: 0.22, yNorm: 0.56, label: '60Hz LOW' },
          { xNorm: 0.37, yNorm: 0.56, label: '350Hz LM' },
          { xNorm: 0.52, yNorm: 0.56, label: '2.4k HM' },
          { xNorm: 0.67, yNorm: 0.56, label: '10k AIR' },
          { xNorm: 0.82, yNorm: 0.56, label: 'PRES Q' },
        ];
        switchMeta = [{ xNorm: 0.09, yNorm: 0.54, label: 'EQ IN' }];
        rearMeta = [
          { xNorm: 0.25, label: 'EQ IN', dir: 'IN' },
          { xNorm: 0.75, label: 'EQ OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'eq', spec.yCenter, spec.height, 0.09, 0.54, spec.accentNum, 'power', 'EQ Active', (p) => p.eq.power);
        addKnob(cx, 'eq', spec.yCenter, spec.height, 0.22, 0.56, spec.accentNum, isSilver, 'lowGain', '60Hz Low', -12, 12, 0.2, 'dB', (p) => p.eq.lowGain);
        addKnob(cx, 'eq', spec.yCenter, spec.height, 0.37, 0.56, spec.accentNum, isSilver, 'lowMidGain', '350Hz Low-Mid', -12, 12, 0.2, 'dB', (p) => p.eq.lowMidGain);
        addKnob(cx, 'eq', spec.yCenter, spec.height, 0.52, 0.56, spec.accentNum, isSilver, 'highMidGain', '2.4k High-Mid', -12, 12, 0.2, 'dB', (p) => p.eq.highMidGain);
        addKnob(cx, 'eq', spec.yCenter, spec.height, 0.67, 0.56, spec.accentNum, isSilver, 'highGain', '10kHz High', -12, 12, 0.2, 'dB', (p) => p.eq.highGain);
        addKnob(cx, 'eq', spec.yCenter, spec.height, 0.82, 0.56, spec.accentNum, isSilver, 'presenceQ', 'Presence Q', 0.4, 4.0, 0.05, '', (p) => p.eq.presenceQ);

        addJack(cx, 'eq', spec.yCenter, 0.25, 'eq_in', 'in', 'EQ Input');
        addJack(cx, 'eq', spec.yCenter, 0.75, 'eq_out', 'out', 'EQ Output');
      } else if (spec.id === 'exporter') {
        dialMeta = [{ xNorm: 0.22, yNorm: 0.56, label: 'MASTER' }];
        switchMeta = [
          { xNorm: 0.38, yNorm: 0.54, label: 'NORM' },
          { xNorm: 0.50, yNorm: 0.54, label: 'DITHER' },
          { xNorm: 0.65, yNorm: 0.58, label: '128K WAV' },
        ];
        rearMeta = [{ xNorm: 0.25, label: 'MASTER IN', dir: 'IN' }];

        addKnob(cx, 'exporter', spec.yCenter, spec.height, 0.22, 0.56, spec.accentNum, isSilver, 'masterVolume', 'Master Volume', 0, 1.5, 0.02, 'x', (p) => p.exporter.masterVolume);
        addSwitch(cx, 'exporter', spec.yCenter, spec.height, 0.38, 0.54, spec.accentNum, 'normalize', 'Peak Normalize', (p) => p.exporter.normalize);
        addSwitch(cx, 'exporter', spec.yCenter, spec.height, 0.50, 0.54, spec.accentNum, 'dither', 'TPDF Dither', (p) => p.exporter.dither);
        addPad(cx, 'exporter', spec.yCenter, spec.height, 0.65, 0.54, 'exportPad', 'Export 128k WAV', 'export_wav', 0xeab308, 0x713f12);
        addJack(cx, 'exporter', spec.yCenter, 0.25, 'exp_in', 'in', 'Exporter Input');

        const segGeo = new THREE.BoxGeometry(0.022, 0.034, 0.01);
        disposables.push(segGeo);
        for (let i = 0; i < 10; i++) {
          const segCol = i >= 8 ? 0xef4444 : i >= 6 ? 0xf59e0b : 0x22c55e;
          const sm = new THREE.MeshStandardMaterial({
            color: segCol,
            emissive: segCol,
            emissiveIntensity: 0.08,
          });
          disposables.push(sm);
          expMeterMats.push({ mat: sm, color: segCol });
          const m = new THREE.Mesh(segGeo, sm);
          m.position.set(cx + 0.76 + i * 0.03, spec.yCenter - 0.02, frontZ + 0.01);
          rackGroup.add(m);
        }
      } else if (spec.id === 'phaseNull') {
        dialMeta = [
          { xNorm: 0.34, yNorm: 0.56, label: 'CANCEL %' },
          { xNorm: 0.50, yNorm: 0.56, label: 'NULL FLR' },
          { xNorm: 0.66, yNorm: 0.56, label: '0dB FOCUS' },
        ];
        switchMeta = [
          { xNorm: 0.09, yNorm: 0.54, label: 'INV ON' },
          { xNorm: 0.21, yNorm: 0.54, label: '-180° POL' },
        ];
        rearMeta = [
          { xNorm: 0.25, label: 'NULL IN', dir: 'IN' },
          { xNorm: 0.75, label: 'NULL OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'phaseNull', spec.yCenter, spec.height, 0.09, 0.54, spec.accentNum, 'power', 'Phase Null Power', (p) => p.phaseNull.power);
        addSwitch(cx, 'phaseNull', spec.yCenter, spec.height, 0.21, 0.54, spec.accentNum, 'polarityInvert', '-180° Invert', (p) => p.phaseNull.polarityInvert);
        addKnob(cx, 'phaseNull', spec.yCenter, spec.height, 0.34, 0.56, spec.accentNum, isSilver, 'cancelDepth', 'Cancel Depth', 0, 1, 0.02, '%', (p) => p.phaseNull.cancelDepth);
        addKnob(cx, 'phaseNull', spec.yCenter, spec.height, 0.50, 0.56, spec.accentNum, isSilver, 'nullFloor', 'Silence Null Floor', 0.002, 0.25, 0.002, '', (p) => p.phaseNull.nullFloor);
        addKnob(cx, 'phaseNull', spec.yCenter, spec.height, 0.66, 0.56, spec.accentNum, isSilver, 'zeroDbFocus', '0dB Pocket Focus', 0, 1, 0.02, '%', (p) => p.phaseNull.zeroDbFocus);
        addJack(cx, 'phaseNull', spec.yCenter, 0.25, 'null_in', 'in', 'Phase Null Input');
        addJack(cx, 'phaseNull', spec.yCenter, 0.75, 'null_out', 'out', 'Phase Null Output');

        // 4-Bar Phase Null Residual OLED
        const bgGeo = new THREE.PlaneGeometry(0.36, 0.22);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x061016 });
        const bgMesh = new THREE.Mesh(bgGeo, bgMat);
        bgMesh.position.set(cx + 0.79, spec.yCenter - 0.02, frontZ + 0.007);
        rackGroup.add(bgMesh);

        const barGeo = new THREE.BoxGeometry(0.042, 0.16, 0.008);
        disposables.push(bgGeo, bgMat, barGeo);
        for (let b = 0; b < 4; b++) {
          const barCol = b % 2 === 0 ? 0x06b6d4 : 0x38bdf8;
          const barMat = new THREE.MeshBasicMaterial({ color: barCol });
          disposables.push(barMat);
          const bm = new THREE.Mesh(barGeo, barMat);
          bm.position.set(cx + 0.69 + b * 0.068, spec.yCenter - 0.08, frontZ + 0.011);
          rackGroup.add(bm);
          nullBarMeshes.push(bm);
        }
      } else if (spec.id === 'acousticSpace') {
        dialMeta = [
          { xNorm: 0.21, yNorm: 0.56, label: 'WIDTH' },
          { xNorm: 0.35, yNorm: 0.56, label: 'LOW PAN' },
          { xNorm: 0.49, yNorm: 0.56, label: 'LM PAN' },
          { xNorm: 0.63, yNorm: 0.56, label: 'HM PAN' },
          { xNorm: 0.77, yNorm: 0.56, label: 'HI PAN' },
        ];
        switchMeta = [{ xNorm: 0.08, yNorm: 0.54, label: 'SPACE' }];
        rearMeta = [
          { xNorm: 0.25, label: 'SPACE IN', dir: 'IN' },
          { xNorm: 0.75, label: 'SPACE OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'acousticSpace', spec.yCenter, spec.height, 0.08, 0.54, spec.accentNum, 'power', 'Acoustic Space Power', (p) => p.acousticSpace.power);
        addKnob(cx, 'acousticSpace', spec.yCenter, spec.height, 0.21, 0.56, spec.accentNum, isSilver, 'roomWidth', 'Room Width', 0, 1.5, 0.02, 'x', (p) => p.acousticSpace.roomWidth);
        addKnob(cx, 'acousticSpace', spec.yCenter, spec.height, 0.35, 0.56, spec.accentNum, isSilver, 'low.pan', 'Low Band Pan', -1, 1, 0.02, '', (p) => p.acousticSpace.low.pan);
        addKnob(cx, 'acousticSpace', spec.yCenter, spec.height, 0.49, 0.56, spec.accentNum, isSilver, 'lowMid.pan', 'Low-Mid Pan', -1, 1, 0.02, '', (p) => p.acousticSpace.lowMid.pan);
        addKnob(cx, 'acousticSpace', spec.yCenter, spec.height, 0.63, 0.56, spec.accentNum, isSilver, 'highMid.pan', 'High-Mid Pan', -1, 1, 0.02, '', (p) => p.acousticSpace.highMid.pan);
        addKnob(cx, 'acousticSpace', spec.yCenter, spec.height, 0.77, 0.56, spec.accentNum, isSilver, 'high.pan', 'High Air Pan', -1, 1, 0.02, '', (p) => p.acousticSpace.high.pan);

        addJack(cx, 'acousticSpace', spec.yCenter, 0.25, 'spc_in', 'in', 'Acoustic Space Input');
        addJack(cx, 'acousticSpace', spec.yCenter, 0.75, 'spc_out', 'out', 'Acoustic Space Output');

        // 4 Separated Band Space Level Bars (LOW / LMID / HMID / HIGH)
        const sBgGeo = new THREE.PlaneGeometry(0.24, 0.24);
        const sBgMat = new THREE.MeshBasicMaterial({ color: 0x0d0a1a });
        const sBg = new THREE.Mesh(sBgGeo, sBgMat);
        sBg.position.set(cx + 0.91, spec.yCenter - 0.02, frontZ + 0.007);
        rackGroup.add(sBg);

        const sBarGeo = new THREE.BoxGeometry(0.032, 0.17, 0.008);
        const bandColors = [0x8b5cf6, 0x06b6d4, 0x10b981, 0xec4899];
        disposables.push(sBgGeo, sBgMat, sBarGeo);
        for (let b = 0; b < 4; b++) {
          const bmMat = new THREE.MeshBasicMaterial({ color: bandColors[b] });
          disposables.push(bmMat);
          const bm = new THREE.Mesh(sBarGeo, bmMat);
          bm.position.set(cx + 0.835 + b * 0.05, spec.yCenter - 0.08, frontZ + 0.011);
          rackGroup.add(bm);
          spcBandMeshes.push(bm);
        }
      } else if (spec.id === 'revAmp') {
        dialMeta = [
          { xNorm: 0.22, yNorm: 0.56, label: 'REV FREQ' },
          { xNorm: 0.37, yNorm: 0.56, label: 'NEG AMP' },
          { xNorm: 0.52, yNorm: 0.56, label: 'PIVOT Hz' },
        ];
        switchMeta = [
          { xNorm: 0.09, yNorm: 0.54, label: 'REV ON' },
          { xNorm: 0.65, yNorm: 0.54, label: '0dB CLAMP' },
        ];
        rearMeta = [
          { xNorm: 0.25, label: 'REV IN', dir: 'IN' },
          { xNorm: 0.75, label: 'REV OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'revAmp', spec.yCenter, spec.height, 0.09, 0.54, spec.accentNum, 'power', 'Rev-Freq Amp Power', (p) => p.revAmp.power);
        addKnob(cx, 'revAmp', spec.yCenter, spec.height, 0.22, 0.56, spec.accentNum, isSilver, 'reverseFreq', 'Reverse Freq Tilt', 0, 1, 0.02, '%', (p) => p.revAmp.reverseFreq);
        addKnob(cx, 'revAmp', spec.yCenter, spec.height, 0.37, 0.56, spec.accentNum, isSilver, 'negAmpGainDb', 'Negative Silence Gain', 0, 24, 0.2, 'dB', (p) => p.revAmp.negAmpGainDb);
        addKnob(cx, 'revAmp', spec.yCenter, spec.height, 0.52, 0.56, spec.accentNum, isSilver, 'mirrorPivotHz', 'Mirror Pivot Hz', 200, 6000, 20, 'Hz', (p) => p.revAmp.mirrorPivotHz);
        addSwitch(cx, 'revAmp', spec.yCenter, spec.height, 0.65, 0.54, spec.accentNum, 'trueZeroClamp', 'True-0dB Clamp', (p) => p.revAmp.trueZeroClamp);

        addJack(cx, 'revAmp', spec.yCenter, 0.25, 'rev_in', 'in', 'Rev-Freq Input');
        addJack(cx, 'revAmp', spec.yCenter, 0.75, 'rev_out', 'out', 'Rev-Freq Output');

        // Cryo Cyan Backlit Zero-dB VU Meter
        const vuFrameGeo = new THREE.BoxGeometry(0.42, 0.30, 0.024);
        const vuBackMat = new THREE.MeshStandardMaterial({
          color: 0xcffafe,
          emissive: 0x06b6d4,
          emissiveIntensity: 0.22,
          roughness: 0.44,
        });
        const vuFrame = new THREE.Mesh(vuFrameGeo, vuBackMat);
        vuFrame.position.set(cx + 0.69, spec.yCenter - 0.02, frontZ + 0.008);
        rackGroup.add(vuFrame);

        revVuNeedlePivot = new THREE.Group();
        revVuNeedlePivot.position.set(cx + 0.69, spec.yCenter - 0.12, frontZ + 0.025);
        const needleGeo = new THREE.BoxGeometry(0.008, 0.21, 0.005);
        needleGeo.translate(0, 0.105, 0);
        const needleMat = new THREE.MeshBasicMaterial({ color: 0x083344 });
        revVuNeedlePivot.add(new THREE.Mesh(needleGeo, needleMat));
        rackGroup.add(revVuNeedlePivot);

        // Glowing cryo cyan/violet vacuum tube
        const tubeGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.13, 14);
        cryoTubeGlowMat = new THREE.MeshStandardMaterial({
          color: 0x67e8f9,
          emissive: 0x06b6d4,
          emissiveIntensity: 0.85,
          roughness: 0.14,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, cryoTubeGlowMat);
        tubeMesh.position.set(cx + 0.95, spec.yCenter - 0.02, frontZ + 0.02);
        rackGroup.add(tubeMesh);

        disposables.push(vuFrameGeo, vuBackMat, needleGeo, needleMat, tubeGeo, cryoTubeGlowMat);
      } else if (spec.id === 'negMaster') {
        dialMeta = [
          { xNorm: 0.28, yNorm: 0.56, label: 'NEG THR' },
          { xNorm: 0.41, yNorm: 0.56, label: 'INV RAT' },
          { xNorm: 0.54, yNorm: 0.56, label: '0dB LIFT' },
          { xNorm: 0.67, yNorm: 0.56, label: 'GATE FLR' },
          { xNorm: 0.80, yNorm: 0.56, label: 'CEIL 0dB' },
        ];
        switchMeta = [
          { xNorm: 0.07, yNorm: 0.54, label: 'NCL ON' },
          { xNorm: 0.17, yNorm: 0.54, label: 'INV GATE' },
        ];
        rearMeta = [
          { xNorm: 0.28, label: 'NCL IN', dir: 'IN' },
          { xNorm: 0.72, label: 'NCL OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'negMaster', spec.yCenter, spec.height, 0.07, 0.54, spec.accentNum, 'power', 'Neg Master Power', (p) => p.negMaster.power);
        addSwitch(cx, 'negMaster', spec.yCenter, spec.height, 0.17, 0.54, spec.accentNum, 'gateInvert', 'Inverse Silence Gate', (p) => p.negMaster.gateInvert);
        addKnob(cx, 'negMaster', spec.yCenter, spec.height, 0.28, 0.56, spec.accentNum, isSilver, 'negThreshold', 'Negative Threshold', -60, -3, 1, 'dB', (p) => p.negMaster.negThreshold);
        addKnob(cx, 'negMaster', spec.yCenter, spec.height, 0.41, 0.56, spec.accentNum, isSilver, 'invRatio', 'Inverse Ratio', 1, 20, 0.5, ':1', (p) => p.negMaster.invRatio);
        addKnob(cx, 'negMaster', spec.yCenter, spec.height, 0.54, 0.56, spec.accentNum, isSilver, 'silenceLift', 'Silence 0dB Lift', 0, 1, 0.02, '%', (p) => p.negMaster.silenceLift);
        addKnob(cx, 'negMaster', spec.yCenter, spec.height, 0.67, 0.56, spec.accentNum, isSilver, 'gateFloorDb', 'Gate Floor dB', -72, -12, 1, 'dB', (p) => p.negMaster.gateFloorDb);
        addKnob(cx, 'negMaster', spec.yCenter, spec.height, 0.80, 0.56, spec.accentNum, isSilver, 'limiterCeilingDb', '0dB Limiter Ceiling', -3, 0, 0.1, 'dB', (p) => p.negMaster.limiterCeilingDb);

        addJack(cx, 'negMaster', spec.yCenter, 0.28, 'ncl_in', 'in', 'Neg Master Input');
        addJack(cx, 'negMaster', spec.yCenter, 0.72, 'ncl_out', 'out', 'Neg Master Output');

        const nLedGeo = new THREE.BoxGeometry(0.028, 0.019, 0.012);
        disposables.push(nLedGeo);
        for (let i = 0; i < 8; i++) {
          const ledCol = i >= 6 ? 0xffffff : i >= 4 ? 0x06b6d4 : 0xec4899;
          const lm = new THREE.MeshStandardMaterial({
            color: ledCol,
            emissive: ledCol,
            emissiveIntensity: 0.1,
          });
          disposables.push(lm);
          nclLadderMats.push({ mat: lm, color: ledCol });
          const lMesh = new THREE.Mesh(nLedGeo, lm);
          lMesh.position.set(cx + 0.96, spec.yCenter - 0.18 + i * 0.045, frontZ + 0.01);
          rackGroup.add(lMesh);
        }
      } else if (spec.id === 'zeroDbBus') {
        dialMeta = [
          { xNorm: 0.36, yNorm: 0.56, label: 'PHASE' },
          { xNorm: 0.52, yNorm: 0.56, label: 'BUS TRIM' },
        ];
        switchMeta = [
          { xNorm: 0.09, yNorm: 0.54, label: 'BUS ON' },
          { xNorm: 0.22, yNorm: 0.54, label: '0dB LOCK' },
        ];
        rearMeta = [
          { xNorm: 0.25, label: 'ZDB IN', dir: 'IN' },
          { xNorm: 0.75, label: 'ZDB OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'zeroDbBus', spec.yCenter, spec.height, 0.09, 0.54, spec.accentNum, 'power', 'Zero-dB Bus Power', (p) => p.zeroDbBus.power);
        addSwitch(cx, 'zeroDbBus', spec.yCenter, spec.height, 0.22, 0.54, spec.accentNum, 'trueZeroLock', 'True-0dB Reference Lock', (p) => p.zeroDbBus.trueZeroLock);
        addKnob(cx, 'zeroDbBus', spec.yCenter, spec.height, 0.36, 0.56, spec.accentNum, isSilver, 'phaseCoherence', 'Phase Coherence', -1, 1, 0.02, '', (p) => p.zeroDbBus.phaseCoherence);
        addKnob(cx, 'zeroDbBus', spec.yCenter, spec.height, 0.52, 0.56, spec.accentNum, isSilver, 'busTrim', 'Zero-dB Bus Trim', 0.2, 1.5, 0.02, 'x', (p) => p.zeroDbBus.busTrim);

        addJack(cx, 'zeroDbBus', spec.yCenter, 0.25, 'zdb_in', 'in', 'Zero-dB Bus Input');
        addJack(cx, 'zeroDbBus', spec.yCenter, 0.75, 'zdb_out', 'out', 'Zero-dB Bus Output');

        const segGeo = new THREE.BoxGeometry(0.022, 0.034, 0.01);
        disposables.push(segGeo);
        for (let i = 0; i < 10; i++) {
          const segCol = i >= 8 ? 0xffffff : i >= 5 ? 0x22d3ee : 0x8b5cf6;
          const sm = new THREE.MeshStandardMaterial({
            color: segCol,
            emissive: segCol,
            emissiveIntensity: 0.08,
          });
          disposables.push(sm);
          zdbMeterMats.push({ mat: sm, color: segCol });
          const m = new THREE.Mesh(segGeo, sm);
          m.position.set(cx + 0.74 + i * 0.03, spec.yCenter - 0.02, frontZ + 0.01);
          rackGroup.add(m);
        }
      } else if (spec.id === 'tapeSat') {
        dialMeta = [
          { xNorm: 0.28, yNorm: 0.56, label: 'WARMTH' },
          { xNorm: 0.42, yNorm: 0.56, label: 'SATURATE' },
          { xNorm: 0.56, yNorm: 0.56, label: 'FLUTTER' },
        ];
        switchMeta = [
          { xNorm: 0.08, yNorm: 0.54, label: 'TAPE ON' },
          { xNorm: 0.17, yNorm: 0.54, label: '30 IPS' },
        ];
        rearMeta = [
          { xNorm: 0.25, label: 'TAPE IN', dir: 'IN' },
          { xNorm: 0.75, label: 'TAPE OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'tapeSat', spec.yCenter, spec.height, 0.08, 0.54, spec.accentNum, 'power', 'Tape Deck Power', (p) => p.tapeSat.power);
        addSwitch(cx, 'tapeSat', spec.yCenter, spec.height, 0.17, 0.54, spec.accentNum, 'ips30', '30 / 15 IPS Speed', (p) => p.tapeSat.ips30);
        addKnob(cx, 'tapeSat', spec.yCenter, spec.height, 0.28, 0.56, spec.accentNum, isSilver, 'warmth', 'Tape Warmth', 0, 1, 0.02, '%', (p) => p.tapeSat.warmth);
        addKnob(cx, 'tapeSat', spec.yCenter, spec.height, 0.42, 0.56, spec.accentNum, isSilver, 'saturation', 'Tape Saturation', 0, 1, 0.02, '%', (p) => p.tapeSat.saturation);
        addKnob(cx, 'tapeSat', spec.yCenter, spec.height, 0.56, 0.56, spec.accentNum, isSilver, 'wowFlutter', 'Wow & Flutter', 0, 1, 0.02, '%', (p) => p.tapeSat.wowFlutter);
        addJack(cx, 'tapeSat', spec.yCenter, 0.25, 'tap_in', 'in', 'Tape Sat Input');
        addJack(cx, 'tapeSat', spec.yCenter, 0.75, 'tap_out', 'out', 'Tape Sat Output');

        // Spinning 3D Analog Tape Reels
        const reelDiscGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.022, 22);
        reelDiscGeo.rotateX(Math.PI / 2);
        const reelSpokeGeo = new THREE.BoxGeometry(0.18, 0.02, 0.028);
        const hubGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.03, 14);
        hubGeo.rotateX(Math.PI / 2);
        disposables.push(reelDiscGeo, reelSpokeGeo, hubGeo);

        tapeReelLeft = new THREE.Group();
        tapeReelLeft.position.set(cx + 0.65, spec.yCenter - 0.02, frontZ + 0.015);
        tapeReelLeft.add(new THREE.Mesh(reelDiscGeo, chromeMat));
        tapeReelLeft.add(new THREE.Mesh(reelSpokeGeo, knobBlackMat));
        tapeReelLeft.add(new THREE.Mesh(hubGeo, brassMat));
        rackGroup.add(tapeReelLeft);

        tapeReelRight = new THREE.Group();
        tapeReelRight.position.set(cx + 0.92, spec.yCenter - 0.02, frontZ + 0.015);
        tapeReelRight.add(new THREE.Mesh(reelDiscGeo, chromeMat));
        tapeReelRight.add(new THREE.Mesh(reelSpokeGeo, knobBlackMat));
        tapeReelRight.add(new THREE.Mesh(hubGeo, brassMat));
        rackGroup.add(tapeReelRight);
      } else if (spec.id === 'luxuryVerb') {
        dialMeta = [
          { xNorm: 0.30, yNorm: 0.56, label: 'MIX' },
          { xNorm: 0.44, yNorm: 0.56, label: 'DECAY' },
          { xNorm: 0.58, yNorm: 0.56, label: 'PRE-DLY' },
          { xNorm: 0.72, yNorm: 0.56, label: 'SHIMMER' },
        ];
        switchMeta = [
          { xNorm: 0.08, yNorm: 0.54, label: 'HALL ON' },
          { xNorm: 0.18, yNorm: 0.54, label: 'SPREAD' },
        ];
        rearMeta = [
          { xNorm: 0.25, label: 'LUX IN', dir: 'IN' },
          { xNorm: 0.75, label: 'LUX OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'luxuryVerb', spec.yCenter, spec.height, 0.08, 0.54, spec.accentNum, 'power', 'Luxury Verb Power', (p) => p.luxuryVerb.power);
        addSwitch(cx, 'luxuryVerb', spec.yCenter, spec.height, 0.18, 0.54, spec.accentNum, 'stereoSpread', 'Wide Hall Spread', (p) => p.luxuryVerb.stereoSpread);
        addKnob(cx, 'luxuryVerb', spec.yCenter, spec.height, 0.30, 0.56, spec.accentNum, isSilver, 'mix', 'Hall Wet Mix', 0, 0.85, 0.02, '%', (p) => p.luxuryVerb.mix);
        addKnob(cx, 'luxuryVerb', spec.yCenter, spec.height, 0.44, 0.56, spec.accentNum, isSilver, 'decaySec', 'Hall Decay Sec', 0.5, 5.5, 0.1, '', (p) => p.luxuryVerb.decaySec);
        addKnob(cx, 'luxuryVerb', spec.yCenter, spec.height, 0.58, 0.56, spec.accentNum, isSilver, 'preDelayMs', 'Pre-Delay ms', 0, 100, 2, '', (p) => p.luxuryVerb.preDelayMs);
        addKnob(cx, 'luxuryVerb', spec.yCenter, spec.height, 0.72, 0.56, spec.accentNum, isSilver, 'shimmer', 'Hall Shimmer', 0, 1, 0.02, '%', (p) => p.luxuryVerb.shimmer);
        addJack(cx, 'luxuryVerb', spec.yCenter, 0.25, 'lux_in', 'in', 'Luxury Hall Input');
        addJack(cx, 'luxuryVerb', spec.yCenter, 0.75, 'lux_out', 'out', 'Luxury Hall Output');

        const lBgGeo = new THREE.PlaneGeometry(0.30, 0.22);
        const lBgMat = new THREE.MeshBasicMaterial({ color: 0x161106 });
        const lBg = new THREE.Mesh(lBgGeo, lBgMat);
        lBg.position.set(cx + 0.88, spec.yCenter - 0.02, frontZ + 0.007);
        rackGroup.add(lBg);

        const lBarGeo = new THREE.BoxGeometry(0.028, 0.16, 0.008);
        disposables.push(lBgGeo, lBgMat, lBarGeo);
        for (let b = 0; b < 6; b++) {
          const lmMat = new THREE.MeshBasicMaterial({ color: b >= 4 ? 0xfef08a : 0xf59e0b });
          disposables.push(lmMat);
          const bm = new THREE.Mesh(lBarGeo, lmMat);
          bm.position.set(cx + 0.78 + b * 0.04, spec.yCenter - 0.08, frontZ + 0.011);
          rackGroup.add(bm);
          luxBarMeshes.push(bm);
        }
      } else if (spec.id === 'harmonicExciter') {
        dialMeta = [
          { xNorm: 0.30, yNorm: 0.56, label: 'TUNE Hz' },
          { xNorm: 0.44, yNorm: 0.56, label: 'HARM' },
          { xNorm: 0.58, yNorm: 0.56, label: 'SUB PCH' },
          { xNorm: 0.72, yNorm: 0.56, label: 'AIR dB' },
        ];
        switchMeta = [
          { xNorm: 0.08, yNorm: 0.54, label: 'EXC ON' },
          { xNorm: 0.18, yNorm: 0.54, label: 'TRIODE' },
        ];
        rearMeta = [
          { xNorm: 0.25, label: 'EXC IN', dir: 'IN' },
          { xNorm: 0.75, label: 'EXC OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'harmonicExciter', spec.yCenter, spec.height, 0.08, 0.54, spec.accentNum, 'power', 'Exciter Power', (p) => p.harmonicExciter.power);
        addSwitch(cx, 'harmonicExciter', spec.yCenter, spec.height, 0.18, 0.54, spec.accentNum, 'tubeOddEven', 'Triode / Pentode', (p) => p.harmonicExciter.tubeOddEven);
        addKnob(cx, 'harmonicExciter', spec.yCenter, spec.height, 0.30, 0.56, spec.accentNum, isSilver, 'tuneHz', 'Tune Hz', 1500, 8000, 50, 'Hz', (p) => p.harmonicExciter.tuneHz);
        addKnob(cx, 'harmonicExciter', spec.yCenter, spec.height, 0.44, 0.56, spec.accentNum, isSilver, 'harmonics', 'Harmonics', 0, 1, 0.02, '%', (p) => p.harmonicExciter.harmonics);
        addKnob(cx, 'harmonicExciter', spec.yCenter, spec.height, 0.58, 0.56, spec.accentNum, isSilver, 'subPunch', 'Sub Punch', 0, 1, 0.02, '%', (p) => p.harmonicExciter.subPunch);
        addKnob(cx, 'harmonicExciter', spec.yCenter, spec.height, 0.72, 0.56, spec.accentNum, isSilver, 'airGainDb', 'Air Gain dB', 0, 10, 0.2, 'dB', (p) => p.harmonicExciter.airGainDb);
        addJack(cx, 'harmonicExciter', spec.yCenter, 0.25, 'exc_in', 'in', 'Exciter Input');
        addJack(cx, 'harmonicExciter', spec.yCenter, 0.75, 'exc_out', 'out', 'Exciter Output');

        const eTubeGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.14, 14);
        excTubeGlowMat = new THREE.MeshStandardMaterial({
          color: 0xfed7aa,
          emissive: 0xd97706,
          emissiveIntensity: 0.85,
          roughness: 0.15,
        });
        const eTube = new THREE.Mesh(eTubeGeo, excTubeGlowMat);
        eTube.position.set(cx + 0.92, spec.yCenter - 0.02, frontZ + 0.02);
        rackGroup.add(eTube);
        disposables.push(eTubeGeo, excTubeGlowMat);
      } else if (spec.id === 'stereoImager') {
        dialMeta = [
          { xNorm: 0.30, yNorm: 0.56, label: 'WIDTH' },
          { xNorm: 0.44, yNorm: 0.56, label: 'MID dB' },
          { xNorm: 0.58, yNorm: 0.56, label: 'SIDE dB' },
          { xNorm: 0.72, yNorm: 0.56, label: 'MONO Hz' },
        ];
        switchMeta = [
          { xNorm: 0.08, yNorm: 0.54, label: 'IMG ON' },
          { xNorm: 0.18, yNorm: 0.54, label: 'S-SOLO' },
        ];
        rearMeta = [
          { xNorm: 0.25, label: 'IMG IN', dir: 'IN' },
          { xNorm: 0.75, label: 'IMG OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'stereoImager', spec.yCenter, spec.height, 0.08, 0.54, spec.accentNum, 'power', 'Imager Power', (p) => p.stereoImager.power);
        addSwitch(cx, 'stereoImager', spec.yCenter, spec.height, 0.18, 0.54, spec.accentNum, 'msSolo', 'Side Solo Monitor', (p) => p.stereoImager.msSolo);
        addKnob(cx, 'stereoImager', spec.yCenter, spec.height, 0.30, 0.56, spec.accentNum, isSilver, 'width', 'Stereo Width', 0, 2, 0.02, 'x', (p) => p.stereoImager.width);
        addKnob(cx, 'stereoImager', spec.yCenter, spec.height, 0.44, 0.56, spec.accentNum, isSilver, 'midGainDb', 'Mid Gain', -6, 6, 0.2, 'dB', (p) => p.stereoImager.midGainDb);
        addKnob(cx, 'stereoImager', spec.yCenter, spec.height, 0.58, 0.56, spec.accentNum, isSilver, 'sideGainDb', 'Side Gain', -6, 6, 0.2, 'dB', (p) => p.stereoImager.sideGainDb);
        addKnob(cx, 'stereoImager', spec.yCenter, spec.height, 0.72, 0.56, spec.accentNum, isSilver, 'lowMonoHz', 'Low Mono Hz', 40, 240, 5, 'Hz', (p) => p.stereoImager.lowMonoHz);
        addJack(cx, 'stereoImager', spec.yCenter, 0.25, 'img_in', 'in', 'Imager Input');
        addJack(cx, 'stereoImager', spec.yCenter, 0.75, 'img_out', 'out', 'Imager Output');

        const cSegGeo = new THREE.BoxGeometry(0.028, 0.024, 0.01);
        disposables.push(cSegGeo);
        for (let i = 0; i < 6; i++) {
          const cCol = i >= 4 ? 0x38bdf8 : i >= 2 ? 0x10b981 : 0xf59e0b;
          const cmMat = new THREE.MeshStandardMaterial({
            color: cCol,
            emissive: cCol,
            emissiveIntensity: 0.12,
          });
          disposables.push(cmMat);
          imgCorrMats.push({ mat: cmMat, color: cCol });
          const m = new THREE.Mesh(cSegGeo, cmMat);
          m.position.set(cx + 0.81 + i * 0.036, spec.yCenter - 0.02, frontZ + 0.01);
          rackGroup.add(m);
        }
      } else if (spec.id === 'luxuryMaster') {
        dialMeta = [
          { xNorm: 0.44, yNorm: 0.56, label: 'CEIL dB' },
          { xNorm: 0.58, yNorm: 0.56, label: 'GLOW %' },
        ];
        switchMeta = [
          { xNorm: 0.08, yNorm: 0.54, label: 'FIN ON' },
          { xNorm: 0.19, yNorm: 0.54, label: 'DIM -12' },
          { xNorm: 0.30, yNorm: 0.54, label: 'MONO' },
        ];
        rearMeta = [
          { xNorm: 0.25, label: 'FIN IN', dir: 'IN' },
          { xNorm: 0.75, label: 'FIN OUT', dir: 'OUT' },
        ];

        addSwitch(cx, 'luxuryMaster', spec.yCenter, spec.height, 0.08, 0.54, spec.accentNum, 'power', 'Reference Stage Power', (p) => p.luxuryMaster.power);
        addSwitch(cx, 'luxuryMaster', spec.yCenter, spec.height, 0.19, 0.54, spec.accentNum, 'dimSwitch', '-12dB Reference Dim', (p) => p.luxuryMaster.dimSwitch);
        addSwitch(cx, 'luxuryMaster', spec.yCenter, spec.height, 0.30, 0.54, spec.accentNum, 'monoCheck', 'Mono Phase Check', (p) => p.luxuryMaster.monoCheck);
        addKnob(cx, 'luxuryMaster', spec.yCenter, spec.height, 0.44, 0.56, spec.accentNum, isSilver, 'ceilingDb', 'Ceiling dB', -3, 0, 0.1, 'dB', (p) => p.luxuryMaster.ceilingDb);
        addKnob(cx, 'luxuryMaster', spec.yCenter, spec.height, 0.58, 0.56, spec.accentNum, isSilver, 'analogGlow', 'Velvet Glow', 0, 1, 0.02, '%', (p) => p.luxuryMaster.analogGlow);
        addJack(cx, 'luxuryMaster', spec.yCenter, 0.25, 'fin_in', 'in', 'Champagne Input');
        addJack(cx, 'luxuryMaster', spec.yCenter, 0.75, 'fin_out', 'out', 'Champagne Output');

        const fSegGeo = new THREE.BoxGeometry(0.022, 0.034, 0.01);
        disposables.push(fSegGeo);
        for (let i = 0; i < 10; i++) {
          const segCol = i >= 8 ? 0xf59e0b : 0xe8c488;
          const fm = new THREE.MeshStandardMaterial({
            color: segCol,
            emissive: segCol,
            emissiveIntensity: 0.08,
          });
          disposables.push(fm);
          finMeterMats.push({ mat: fm, color: segCol });
          const m = new THREE.Mesh(fSegGeo, fm);
          m.position.set(cx + 0.74 + i * 0.03, spec.yCenter - 0.02, frontZ + 0.01);
          rackGroup.add(m);
        }
      }

      const frontTex = createFaceplateTexture(
        spec.code,
        spec.title,
        spec.faceTone,
        spec.accentHex,
        dialMeta,
        switchMeta
      );
      frontTex.anisotropy = maxAnisotropy;
      const frontMat = new THREE.MeshStandardMaterial({
        map: frontTex,
        roughness: isSilver ? 0.28 : 0.48,
        metalness: isSilver ? 0.72 : 0.45,
      });
      const frontPlaneGeo = new THREE.PlaneGeometry(panelW, spec.height);
      const frontPlate = new THREE.Mesh(frontPlaneGeo, frontMat);
      frontPlate.position.set(cx, spec.yCenter, frontZ - 0.002);
      rackGroup.add(frontPlate);

      const rearTex = createRearPatchbayTexture(spec.code, spec.accentHex, rearMeta);
      rearTex.anisotropy = maxAnisotropy;
      const rearMat = new THREE.MeshStandardMaterial({
        map: rearTex,
        roughness: 0.52,
        metalness: 0.42,
      });
      const rearPlate = new THREE.Mesh(frontPlaneGeo, rearMat);
      rearPlate.rotation.y = Math.PI;
      rearPlate.position.set(cx, spec.yCenter, rearZ + 0.002);
      rackGroup.add(rearPlate);

      disposables.push(frontTex, frontMat, frontPlaneGeo, rearTex, rearMat);
    });

    // --- Real Moving Verlet Physics Patch Cables across Cabinet I <-> Cabinet II ---
    const cableGroup = new THREE.Group();
    rackGroup.add(cableGroup);

    interface ActiveCableMesh {
      cableId: string;
      from: OutputJackId;
      to: InputJackId;
      nodes: THREE.Vector3[];
      prevNodes: THREE.Vector3[];
      restLen: number;
      curve: THREE.CatmullRomCurve3;
      tubeGeo: THREE.BufferGeometry;
      tubeMesh: THREE.Mesh;
      tubeMat: THREE.MeshStandardMaterial;
      plugA: THREE.Mesh;
      plugB: THREE.Mesh;
      plugMat: THREE.MeshStandardMaterial;
      beads: THREE.InstancedMesh;
      beadMat: THREE.MeshBasicMaterial;
      phaseOffset: number;
      isDetachedTail?: boolean;
    }

    const activeCableMeshes: ActiveCableMesh[] = [];
    const cableHitMeshes: THREE.Mesh[] = [];
    const plugGeo = new THREE.CylinderGeometry(0.030, 0.036, 0.10, 14);
    plugGeo.rotateX(Math.PI / 2);
    const beadGeo = new THREE.SphereGeometry(0.025, 10, 10);
    const BEADS_PER_CABLE = 14;
    disposables.push(plugGeo, beadGeo);

    const dragNodes: THREE.Vector3[] = [];
    const dragPrevNodes: THREE.Vector3[] = [];
    for (let i = 0; i < CABLE_NODE_COUNT; i++) {
      dragNodes.push(new THREE.Vector3(0, 2, rearZ - 0.2));
      dragPrevNodes.push(new THREE.Vector3(0, 2, rearZ - 0.2));
    }
    const dragCurve = new THREE.CatmullRomCurve3(dragNodes);
    const dragTubeGeo = createDynamicCableGeometry();
    const dragTubeMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.25,
      roughness: 0.35,
      metalness: 0.25,
    });
    const dragTubeMesh = new THREE.Mesh(dragTubeGeo, dragTubeMat);
    dragTubeMesh.visible = false;
    cableGroup.add(dragTubeMesh);

    const dragPlugLoose = new THREE.Mesh(plugGeo, brassMat);
    dragPlugLoose.visible = false;
    cableGroup.add(dragPlugLoose);
    disposables.push(dragTubeGeo, dragTubeMat);

    function initVerletChain(
      pStart: THREE.Vector3,
      pEnd: THREE.Vector3,
      idx: number
    ): { nodes: THREE.Vector3[]; prevNodes: THREE.Vector3[]; restLen: number } {
      const dist = pStart.distanceTo(pEnd);
      const sag = 0.26 + dist * 0.24 + (idx % 3) * 0.05;
      const totalLen = Math.max(dist * 1.24 + 0.36, 0.72);
      const restLen = totalLen / (CABLE_NODE_COUNT - 1);

      const nodes: THREE.Vector3[] = [];
      const prevNodes: THREE.Vector3[] = [];
      for (let i = 0; i < CABLE_NODE_COUNT; i++) {
        const t = i / (CABLE_NODE_COUNT - 1);
        const arc = Math.sin(t * Math.PI);
        const x = THREE.MathUtils.lerp(pStart.x, pEnd.x, t) + arc * ((idx % 2 === 0 ? 1 : -1) * 0.04);
        const y = THREE.MathUtils.lerp(pStart.y, pEnd.y, t) - arc * sag;
        const z = THREE.MathUtils.lerp(pStart.z, pEnd.z, t) - arc * (0.28 + (idx % 3) * 0.06);
        const pt = new THREE.Vector3(x, y, z);
        nodes.push(pt);
        prevNodes.push(pt.clone().add(new THREE.Vector3(0, 0.01, -0.015)));
      }
      return { nodes, prevNodes, restLen };
    }

    function rebuildCableMeshes(list: PatchCable[]) {
      cableHitMeshes.length = 0;
      for (const cm of activeCableMeshes) {
        cableGroup.remove(cm.tubeMesh);
        cableGroup.remove(cm.plugA);
        cableGroup.remove(cm.plugB);
        cableGroup.remove(cm.beads);
        cm.tubeGeo.dispose();
        cm.tubeMat.dispose();
        cm.plugMat.dispose();
        cm.beadMat.dispose();
      }
      activeCableMeshes.length = 0;

      list.forEach((cable, idx) => {
        const jA = jackMap.get(cable.from);
        const jB = jackMap.get(cable.to);
        if (!jA || !jB) return;

        const pStart = jA.worldAnchorLocal.clone();
        const pEnd = jB.worldAnchorLocal.clone();
        const { nodes, prevNodes, restLen } = initVerletChain(pStart, pEnd, idx);
        const curve = new THREE.CatmullRomCurve3(nodes);
        const tubeGeo = createDynamicCableGeometry();
        updateDynamicCableGeometry(tubeGeo, curve, 0.020);

        const cableColor = CABLE_COLORS[cable.tone] ?? 0xf59e0b;
        const tubeMat = new THREE.MeshStandardMaterial({
          color: cableColor,
          roughness: 0.36,
          metalness: 0.22,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        tubeMesh.castShadow = true;
        tubeMesh.userData.binding = {
          kind: 'cable',
          cableId: cable.id,
          from: cable.from,
          to: cable.to,
          part: 'tube',
        } satisfies CableHitBinding;
        cableGroup.add(tubeMesh);
        cableHitMeshes.push(tubeMesh);

        const plugMat = new THREE.MeshStandardMaterial({
          color: cableColor,
          emissive: cableColor,
          emissiveIntensity: 0.1,
          roughness: 0.22,
          metalness: 0.72,
        });
        const plugA = new THREE.Mesh(plugGeo, plugMat);
        plugA.position.copy(pStart);
        plugA.userData.binding = {
          kind: 'cable',
          cableId: cable.id,
          from: cable.from,
          to: cable.to,
          part: 'plugA',
        } satisfies CableHitBinding;

        const plugB = new THREE.Mesh(plugGeo, plugMat);
        plugB.position.copy(pEnd);
        plugB.userData.binding = {
          kind: 'cable',
          cableId: cable.id,
          from: cable.from,
          to: cable.to,
          part: 'plugB',
        } satisfies CableHitBinding;

        cableGroup.add(plugA, plugB);
        cableHitMeshes.push(plugA, plugB);

        const beadMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.9,
        });
        const beads = new THREE.InstancedMesh(beadGeo, beadMat, BEADS_PER_CABLE);
        beads.frustumCulled = false;
        cableGroup.add(beads);

        activeCableMeshes.push({
          cableId: cable.id,
          from: cable.from,
          to: cable.to,
          nodes,
          prevNodes,
          restLen,
          curve,
          tubeGeo,
          tubeMesh,
          tubeMat,
          plugA,
          plugB,
          plugMat,
          beads,
          beadMat,
          phaseOffset: idx * 0.27,
        });
      });
    }

    let lastCableSig = '';

    // --- Raycasting & Direct 3D Interaction ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const rearDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0, rearZ - 0.34)
    );
    const _planeHit = new THREE.Vector3();

    let activeDragKnob: KnobBinding | null = null;
    let dragStartY = 0;
    let dragStartVal = 0;

    interface CableDragState {
      mode: 'new_from_out' | 'new_from_in' | 'rewire_existing';
      existingCableId?: string;
      anchorFrom?: OutputJackId;
      anchorTo?: InputJackId;
      fixedPos: THREE.Vector3;
      loosePos: THREE.Vector3;
      hoveredSnapJack: JackBinding | null;
      hasMoved: boolean;
    }
    let activeCableDrag: CableDragState | null = null;
    let pointerDownBinding: InteractiveBinding | null = null;
    let pointerDownPos = { x: 0, y: 0 };
    let hoveredBinding: InteractiveBinding | null = null;
    let lastHoverCheck = 0;

    function updatePointerNdc(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickVisibleInteractive(includeCables = true): InteractiveBinding | null {
      raycaster.setFromCamera(pointer, camera);
      const targets = includeCables ? [...hitMeshes, ...cableHitMeshes] : hitMeshes;
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length === 0) return null;

      const chassisHits = raycaster.intersectObjects(chassisOcclusionMeshes, false);
      const firstChassisDist = chassisHits.length > 0 ? chassisHits[0].distance : Infinity;

      for (const h of hits) {
        if (h.distance <= firstChassisDist + 0.08) {
          const b = h.object.userData.binding as InteractiveBinding | undefined;
          if (b) return b;
        }
      }
      return null;
    }

    function computeRearDragWorldPoint(): THREE.Vector3 {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.ray.intersectPlane(rearDragPlane, _planeHit);
      if (!hit) {
        return new THREE.Vector3(0, 2.3, rearZ - 0.35);
      }
      return new THREE.Vector3(
        THREE.MathUtils.clamp(hit.x, -4.9, 4.9),
        THREE.MathUtils.clamp(hit.y, 0.25, 4.7),
        Math.min(rearZ - 0.14, hit.z)
      );
    }

    function findNearestCompatibleJack(
      worldPt: THREE.Vector3,
      desiredDirection: 'in' | 'out'
    ): JackBinding | null {
      let best: JackBinding | null = null;
      let bestDist = 0.32;
      for (const jb of jackMap.values()) {
        if (jb.direction !== desiredDirection) continue;
        const d = jb.worldAnchorLocal.distanceTo(worldPt);
        if (d < bestDist) {
          bestDist = d;
          best = jb;
        }
      }
      return best;
    }

    function onPointerDown(e: PointerEvent) {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      updatePointerNdc(e);
      const binding = pickVisibleInteractive(true);
      pointerDownBinding = binding;
      if (!binding) return;

      controls.enabled = false;
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (binding.kind === 'knob') {
        activeDragKnob = binding;
        dragStartY = e.clientY;
        dragStartVal = binding.getValue(paramsRef.current);
        callbacksRef.current.onSelectControl({
          moduleId: binding.moduleId,
          controlId: binding.controlId,
          label: binding.label,
          formattedValue: formatParamValue(dragStartVal, binding.unit),
        });
      } else if (binding.kind === 'cable') {
        const outJack = jackMap.get(binding.from);
        const inJack = jackMap.get(binding.to);
        if (outJack && inJack) {
          const loose = inJack.worldAnchorLocal.clone();
          activeCableDrag = {
            mode: 'rewire_existing',
            existingCableId: binding.cableId,
            anchorFrom: binding.from,
            fixedPos: outJack.worldAnchorLocal.clone(),
            loosePos: loose,
            hoveredSnapJack: null,
            hasMoved: false,
          };
          const cm = activeCableMeshes.find((c) => c.cableId === binding.cableId);
          if (cm) cm.isDetachedTail = true;
        }
      } else if (binding.kind === 'jack') {
        if (binding.direction === 'out') {
          const pos = binding.worldAnchorLocal.clone();
          for (let i = 0; i < CABLE_NODE_COUNT; i++) {
            dragNodes[i].copy(pos);
            dragPrevNodes[i].copy(pos);
          }
          activeCableDrag = {
            mode: 'new_from_out',
            anchorFrom: binding.jackId as OutputJackId,
            fixedPos: pos.clone(),
            loosePos: pos.clone(),
            hoveredSnapJack: null,
            hasMoved: false,
          };
        } else {
          const existing = cablesRef.current.find((c) => c.to === binding.jackId);
          if (existing) {
            const outJack = jackMap.get(existing.from);
            if (outJack) {
              activeCableDrag = {
                mode: 'rewire_existing',
                existingCableId: existing.id,
                anchorFrom: existing.from,
                fixedPos: outJack.worldAnchorLocal.clone(),
                loosePos: binding.worldAnchorLocal.clone(),
                hoveredSnapJack: null,
                hasMoved: false,
              };
              const cm = activeCableMeshes.find((c) => c.cableId === existing.id);
              if (cm) cm.isDetachedTail = true;
            }
          } else {
            const pos = binding.worldAnchorLocal.clone();
            for (let i = 0; i < CABLE_NODE_COUNT; i++) {
              dragNodes[i].copy(pos);
              dragPrevNodes[i].copy(pos);
            }
            activeCableDrag = {
              mode: 'new_from_in',
              anchorTo: binding.jackId as InputJackId,
              fixedPos: pos.clone(),
              loosePos: pos.clone(),
              hoveredSnapJack: null,
              hasMoved: false,
            };
          }
        }
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (activeDragKnob) {
        const dy = dragStartY - e.clientY;
        const range = activeDragKnob.max - activeDragKnob.min;
        const raw = dragStartVal + (dy / 160) * range;
        const stepped =
          Math.round(
            THREE.MathUtils.clamp(raw, activeDragKnob.min, activeDragKnob.max) /
              activeDragKnob.step
          ) * activeDragKnob.step;
        const clamped = Number(
          THREE.MathUtils.clamp(stepped, activeDragKnob.min, activeDragKnob.max).toFixed(4)
        );
        callbacksRef.current.onUpdateParam(
          activeDragKnob.moduleId,
          activeDragKnob.controlId,
          clamped
        );
        callbacksRef.current.onSelectControl({
          moduleId: activeDragKnob.moduleId,
          controlId: activeDragKnob.controlId,
          label: activeDragKnob.label,
          formattedValue: formatParamValue(clamped, activeDragKnob.unit),
        });
        return;
      }

      if (activeCableDrag) {
        const moved = Math.hypot(
          e.clientX - pointerDownPos.x,
          e.clientY - pointerDownPos.y
        );
        if (moved > 6) {
          activeCableDrag.hasMoved = true;
        }
        if (activeCableDrag.hasMoved) {
          updatePointerNdc(e);
          const worldPt = computeRearDragWorldPoint();
          const targetDir = activeCableDrag.mode === 'new_from_in' ? 'out' : 'in';
          const snap = findNearestCompatibleJack(worldPt, targetDir);
          activeCableDrag.hoveredSnapJack = snap;
          if (snap) {
            activeCableDrag.loosePos.copy(snap.worldAnchorLocal);
          } else {
            activeCableDrag.loosePos.copy(worldPt);
          }

          if (activeCableDrag.mode !== 'rewire_existing') {
            dragTubeMesh.visible = true;
            dragPlugLoose.visible = true;
          } else if (activeCableDrag.existingCableId) {
            const cm = activeCableMeshes.find(
              (c) => c.cableId === activeCableDrag!.existingCableId
            );
            if (cm) cm.isDetachedTail = true;
          }
          renderer.domElement.style.cursor = snap ? 'copy' : 'grabbing';
        }
        return;
      }

      const now = performance.now();
      if (now - lastHoverCheck < 45) return;
      lastHoverCheck = now;

      updatePointerNdc(e);
      const nextHover = pickVisibleInteractive(true);

      if (hoveredBinding && hoveredBinding !== nextHover) {
        if (hoveredBinding.kind === 'knob') {
          (hoveredBinding.ringMesh.material as THREE.MeshBasicMaterial).opacity = 0.25;
        } else if (hoveredBinding.kind === 'cable') {
          const cm = activeCableMeshes.find(
            (c) => c.cableId === (hoveredBinding as CableHitBinding).cableId
          );
          if (cm) cm.tubeMat.emissive.setHex(0x000000);
        }
      }
      hoveredBinding = nextHover;
      if (hoveredBinding) {
        if (hoveredBinding.kind === 'knob') {
          renderer.domElement.style.cursor = 'ns-resize';
          (hoveredBinding.ringMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
        } else if (hoveredBinding.kind === 'cable') {
          renderer.domElement.style.cursor = 'pointer';
          const cm = activeCableMeshes.find(
            (c) => c.cableId === (hoveredBinding as CableHitBinding).cableId
          );
          if (cm) {
            cm.tubeMat.emissive.setHex(0x52525b);
          }
        } else {
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        renderer.domElement.style.cursor = 'grab';
      }
    }

    function onPointerUp(e: PointerEvent) {
      controls.enabled = true;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (activeDragKnob) {
        activeDragKnob = null;
        return;
      }

      if (activeCableDrag) {
        const drag = activeCableDrag;
        activeCableDrag = null;
        dragTubeMesh.visible = false;
        dragPlugLoose.visible = false;

        if (drag.existingCableId) {
          const cm = activeCableMeshes.find((c) => c.cableId === drag.existingCableId);
          if (cm) cm.isDetachedTail = false;
        }

        if (drag.hasMoved) {
          updatePointerNdc(e);
          const worldPt = computeRearDragWorldPoint();
          const targetDir = drag.mode === 'new_from_in' ? 'out' : 'in';
          const snap = findNearestCompatibleJack(worldPt, targetDir) ?? drag.hoveredSnapJack;

          if (drag.mode === 'new_from_out' && drag.anchorFrom) {
            if (snap) {
              callbacksRef.current.onConnectCable(drag.anchorFrom, snap.jackId as InputJackId);
            }
          } else if (drag.mode === 'new_from_in' && drag.anchorTo) {
            if (snap) {
              callbacksRef.current.onConnectCable(snap.jackId as OutputJackId, drag.anchorTo);
            }
          } else if (drag.mode === 'rewire_existing' && drag.existingCableId && drag.anchorFrom) {
            if (snap) {
              callbacksRef.current.onConnectCable(
                drag.anchorFrom,
                snap.jackId as InputJackId,
                drag.existingCableId
              );
            } else {
              callbacksRef.current.onRemoveCable(drag.existingCableId);
            }
          }
          pointerDownBinding = null;
          return;
        }
      }

      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      const binding = pointerDownBinding;
      pointerDownBinding = null;
      if (moved > 7 || !binding) return;

      if (binding.kind === 'switch') {
        const cur = binding.getValue(paramsRef.current);
        callbacksRef.current.onUpdateParam(binding.moduleId, binding.controlId, !cur);
        callbacksRef.current.onSelectControl({
          moduleId: binding.moduleId,
          controlId: binding.controlId,
          label: binding.label,
          formattedValue: !cur ? 'ON' : 'OFF',
        });
      } else if (binding.kind === 'pad') {
        callbacksRef.current.onTransportAction(binding.action);
        callbacksRef.current.onSelectControl({
          moduleId: binding.moduleId,
          controlId: binding.controlId,
          label: binding.label,
          formattedValue: 'TRIGGERED',
        });
      } else if (binding.kind === 'cable') {
        callbacksRef.current.onRemoveCable(binding.cableId);
        callbacksRef.current.onSelectControl({
          moduleId: 'player',
          controlId: binding.cableId,
          label: `${binding.from} -> ${binding.to}`,
          formattedValue: 'UNPLUGGED',
        });
      } else if (binding.kind === 'jack') {
        callbacksRef.current.onJackClick(binding.jackId);
        callbacksRef.current.onSelectControl({
          moduleId: binding.moduleId,
          controlId: binding.jackId,
          label: binding.label,
          formattedValue: binding.direction === 'out' ? 'SEND JACK' : 'RECV JACK',
        });
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let prevCamAzimuth = 0;
    let swayVelocity = 0;
    const _beadPos = new THREE.Vector3();
    const _beadObj = new THREE.Object3D();
    const _deltaVec = new THREE.Vector3();
    const _stepVec = new THREE.Vector3();

    function stepVerletChain(
      nodes: THREE.Vector3[],
      prevNodes: THREE.Vector3[],
      restLen: number,
      pStart: THREE.Vector3,
      pEnd: THREE.Vector3,
      dt: number,
      swayImpulseX: number,
      beatKick: number,
      phaseOffset: number,
      tSec: number
    ) {
      const n = nodes.length;
      const damp = 0.92;
      const gravityStep = -6.2 * dt * dt;
      const swayStep = swayImpulseX * dt * 0.45;
      const waveSwing = Math.sin(tSec * 2.2 + phaseOffset) * 0.0007;

      for (let i = 1; i < n - 1; i++) {
        const cur = nodes[i];
        const prev = prevNodes[i];
        const vx = (cur.x - prev.x) * damp;
        const vy = (cur.y - prev.y) * damp;
        const vz = (cur.z - prev.z) * damp;

        prev.copy(cur);
        cur.x += vx + swayStep + waveSwing;
        cur.y += vy + gravityStep;
        cur.z += vz - beatKick * dt * 0.25;
      }

      nodes[0].copy(pStart);
      prevNodes[0].copy(pStart);
      nodes[n - 1].copy(pEnd);
      prevNodes[n - 1].copy(pEnd);

      for (let iter = 0; iter < 6; iter++) {
        for (let i = 0; i < n - 1; i++) {
          const a = nodes[i];
          const b = nodes[i + 1];
          _deltaVec.subVectors(b, a);
          const d = _deltaVec.length();
          if (d < 0.0001) continue;
          const diff = (d - restLen) / d;
          _stepVec.copy(_deltaVec).multiplyScalar(diff);
          if (i === 0) {
            b.sub(_stepVec);
          } else if (i + 1 === n - 1) {
            a.add(_stepVec);
          } else {
            a.addScaledVector(_stepVec, 0.5);
            b.addScaledVector(_stepVec, -0.5);
          }
        }

        for (let i = 1; i < n - 1; i++) {
          if (nodes[i].z > rearZ - 0.055) {
            nodes[i].z = rearZ - 0.055;
          }
          if (nodes[i].y < 0.06) {
            nodes[i].y = 0.06;
          }
        }
        nodes[0].copy(pStart);
        nodes[n - 1].copy(pEnd);
      }
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick(now: number) {
      if (disposed) return;
      const dt = Math.min(0.035, Math.max(0.001, (now - lastTime) * 0.001));
      lastTime = now;
      const tSec = now * 0.001;

      const curParams = paramsRef.current;
      const curCables = cablesRef.current;
      const telem = telemetryRef.current;

      const sig = curCables.map((c) => `${c.id}:${c.from}>${c.to}:${c.tone}`).join('|');
      if (sig !== lastCableSig) {
        lastCableSig = sig;
        rebuildCableMeshes(curCables);
      }

      const tr = cameraTransitionRef.current;
      if (tr.active) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, tr.targetPos.x, 6, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, tr.targetPos.y, 6, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, tr.targetPos.z, 6, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, tr.targetLook.x, 6, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, tr.targetLook.y, 6, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, tr.targetLook.z, 6, dt);
        if (camera.position.distanceTo(tr.targetPos) < 0.03) {
          tr.active = false;
        }
      }

      controls.autoRotate =
        autoRotateRef.current && !tr.active && !activeDragKnob && !activeCableDrag;
      controls.autoRotateSpeed = 0.85;
      controls.update();

      const srcStatus = sourceStatusRef.current;
      for (const item of interactives) {
        if (item.kind === 'knob') {
          const val = item.getValue(curParams);
          const norm = THREE.MathUtils.clamp((val - item.min) / (item.max - item.min), 0, 1);
          const targetAngle = THREE.MathUtils.lerp(Math.PI * 0.75, -Math.PI * 0.75, norm);
          item.group.rotation.z = THREE.MathUtils.damp(item.group.rotation.z, targetAngle, 16, dt);
        } else if (item.kind === 'switch') {
          const on = item.getValue(curParams);
          const targetX = Math.PI / 2 + (on ? -0.42 : 0.42);
          item.leverPivot.rotation.x = THREE.MathUtils.damp(item.leverPivot.rotation.x, targetX, 18, dt);
          item.ledMat.emissiveIntensity = on ? 1.35 : 0.06;
        } else if (item.kind === 'pad') {
          let active = false;
          if (item.action === 'open_mp3') active = srcStatus.hasLoadedFile;
          else if (item.action === 'play_pause') active = srcStatus.isFilePlaying;
          else if (item.action === 'drone') active = srcStatus.isDronePlaying;
          else if (item.action === 'mic') active = srcStatus.isMicActive;
          item.ledMat.emissiveIntensity = active ? 1.05 : 0.16;
          item.ledMat.color.setHex(active ? item.activeColor : item.idleColor);
        } else if (item.kind === 'jack') {
          const armed = pendingJackRef.current;
          const isPending = armed === item.jackId;
          const isSnapTarget = activeCableDrag?.hoveredSnapJack?.jackId === item.jackId;
          const isValidClickTarget = Boolean(armed && item.direction === 'in');
          const isValidDragTarget = Boolean(
            activeCableDrag &&
              activeCableDrag.hasMoved &&
              ((activeCableDrag.mode === 'new_from_in' && item.direction === 'out') ||
                (activeCableDrag.mode !== 'new_from_in' && item.direction === 'in'))
          );
          item.collarMat.emissiveIntensity =
            isPending || isSnapTarget
              ? 1.5
              : isValidClickTarget || isValidDragTarget
              ? 0.55 + 0.35 * Math.sin(tSec * 7)
              : 0.12;
        }
      }

      // Cabinet I Live Meters
      if (ampVuNeedlePivot) {
        const ampLvl = curParams.amp.power ? telem.moduleLevels.amp : 0;
        const targetNeedle = THREE.MathUtils.lerp(0.68, -0.68, Math.min(1, ampLvl * 1.4));
        ampVuNeedlePivot.rotation.z = THREE.MathUtils.damp(
          ampVuNeedlePivot.rotation.z,
          targetNeedle,
          14,
          dt
        );
      }
      if (tubeGlowMat) {
        tubeGlowMat.emissiveIntensity = curParams.amp.power
          ? 0.45 + curParams.amp.drive * 0.95 + telem.moduleLevels.amp * 0.7
          : 0.04;
      }
      for (let i = 0; i < oledBarMeshes.length; i++) {
        const bm = oledBarMeshes[i];
        const bin = telem.freqBins[i * 2] ?? 0;
        const scaleY = Math.max(0.08, bin * 1.15);
        bm.scale.y = THREE.MathUtils.damp(bm.scale.y, scaleY, 18, dt);
      }
      for (let i = 0; i < cmpLadderMats.length; i++) {
        const thresh = (i + 1) / cmpLadderMats.length;
        const active = curParams.compressor.power && telem.moduleLevels.compressor >= thresh * 0.72;
        cmpLadderMats[i].mat.emissiveIntensity = active ? 1.4 : 0.08;
      }
      for (let i = 0; i < expMeterMats.length; i++) {
        const thresh = (i + 1) / expMeterMats.length;
        const active = telem.moduleLevels.exporter >= thresh * 0.75;
        expMeterMats[i].mat.emissiveIntensity = active ? 1.5 : 0.07;
      }

      // Cabinet II Live Meters
      for (let i = 0; i < nullBarMeshes.length; i++) {
        const bm = nullBarMeshes[i];
        const lvl = curParams.phaseNull.power
          ? telem.moduleLevels.phaseNull * (0.65 + (i % 2) * 0.35) + telem.trueZeroProximity * 0.3
          : 0.08;
        bm.scale.y = THREE.MathUtils.damp(bm.scale.y, THREE.MathUtils.clamp(lvl * 1.25, 0.08, 1.2), 16, dt);
      }
      for (let i = 0; i < spcBandMeshes.length; i++) {
        const bm = spcBandMeshes[i];
        const bandVal = curParams.acousticSpace.power ? (telem.bandSpaceLevels[i] ?? 0) : 0.05;
        bm.scale.y = THREE.MathUtils.damp(bm.scale.y, THREE.MathUtils.clamp(0.1 + bandVal * 1.2, 0.08, 1.25), 16, dt);
      }
      if (revVuNeedlePivot) {
        const liftNorm = curParams.revAmp.power
          ? THREE.MathUtils.clamp(telem.trueZeroProximity * 0.85 + telem.moduleLevels.revAmp * 0.35, 0, 1)
          : 0;
        const targetRevNeedle = THREE.MathUtils.lerp(0.68, -0.68, liftNorm);
        revVuNeedlePivot.rotation.z = THREE.MathUtils.damp(
          revVuNeedlePivot.rotation.z,
          targetRevNeedle,
          14,
          dt
        );
      }
      if (cryoTubeGlowMat) {
        cryoTubeGlowMat.emissiveIntensity = curParams.revAmp.power
          ? 0.48 + (telem.negLiftDb / 24) * 1.1 + telem.trueZeroProximity * 0.65
          : 0.04;
      }
      for (let i = 0; i < nclLadderMats.length; i++) {
        const thresh = (i + 1) / nclLadderMats.length;
        const active =
          curParams.negMaster.power &&
          (telem.moduleLevels.negMaster >= thresh * 0.72 || telem.trueZeroProximity >= thresh * 0.85);
        nclLadderMats[i].mat.emissiveIntensity = active ? 1.45 : 0.08;
      }
      for (let i = 0; i < zdbMeterMats.length; i++) {
        const thresh = (i + 1) / zdbMeterMats.length;
        const active = curParams.zeroDbBus.power && telem.trueZeroProximity >= thresh * 0.78;
        zdbMeterMats[i].mat.emissiveIntensity = active ? 1.55 : 0.08;
      }

      // Cabinet III Live Meters & Reels
      const tapeActive = curParams.tapeSat.power && telem.hasActiveAudio;
      const reelSpeed = tapeActive ? (curParams.tapeSat.ips30 ? 3.2 : 1.7) : 0.08;
      if (tapeReelLeft) tapeReelLeft.rotation.z -= reelSpeed * dt;
      if (tapeReelRight) tapeReelRight.rotation.z -= reelSpeed * dt;

      for (let i = 0; i < luxBarMeshes.length; i++) {
        const bm = luxBarMeshes[i];
        const hallVal = curParams.luxuryVerb.power
          ? (telem.luxRoomLevel ?? 0) * (0.7 + ((i % 3) * 0.18)) + telem.bass * 0.25
          : 0.05;
        bm.scale.y = THREE.MathUtils.damp(bm.scale.y, THREE.MathUtils.clamp(0.08 + hallVal * 1.15, 0.08, 1.25), 14, dt);
      }
      if (excTubeGlowMat) {
        excTubeGlowMat.emissiveIntensity = curParams.harmonicExciter.power
          ? 0.45 + curParams.harmonicExciter.harmonics * 0.9 + (telem.moduleLevels.harmonicExciter ?? 0) * 0.75
          : 0.04;
      }
      for (let i = 0; i < imgCorrMats.length; i++) {
        const thresh = (i + 1) / imgCorrMats.length;
        const corrNorm = THREE.MathUtils.clamp(((telem.stereoCorrelation ?? 1) + 1) * 0.5, 0, 1);
        const active = curParams.stereoImager.power && corrNorm >= thresh * 0.65;
        imgCorrMats[i].mat.emissiveIntensity = active ? 1.35 : 0.08;
      }
      for (let i = 0; i < finMeterMats.length; i++) {
        const thresh = (i + 1) / finMeterMats.length;
        const active = curParams.luxuryMaster.power && (telem.moduleLevels.luxuryMaster ?? 0) >= thresh * 0.72;
        finMeterMats[i].mat.emissiveIntensity = active ? 1.55 : 0.07;
      }
      for (const wMat of monitorWooferMats) {
        wMat.emissiveIntensity = 0.06 + telem.bass * 0.55;
      }

      // AIM SSL 9000G Console Live Meters, Faders, VU Bridge & Monochrome Neon Fractal
      fractalPortalGroup.visible = showFractalRef.current;
      fractalUniforms.uTime.value = tSec;
      fractalUniforms.uBass.value = THREE.MathUtils.damp(
        fractalUniforms.uBass.value,
        telem.bass,
        10,
        dt
      );
      fractalUniforms.uMid.value = THREE.MathUtils.damp(
        fractalUniforms.uMid.value,
        telem.mid,
        10,
        dt
      );
      fractalUniforms.uTreble.value = THREE.MathUtils.damp(
        fractalUniforms.uTreble.value,
        telem.treble,
        10,
        dt
      );
      fractalUniforms.uBeat.value = THREE.MathUtils.damp(
        fractalUniforms.uBeat.value,
        telem.isBeatTriggered ? 1.0 : 0.0,
        12,
        dt
      );

      for (let i = 0; i < sslVuNeedles.length; i++) {
        const needleNorm = THREE.MathUtils.clamp(
          (telem.sslVcaGrDb / 14) * 0.65 + telem.rms * 0.6,
          0,
          1
        );
        const tgtAngle = THREE.MathUtils.lerp(0.55, -0.55, needleNorm);
        sslVuNeedles[i].rotation.z = THREE.MathUtils.damp(
          sslVuNeedles[i].rotation.z,
          tgtAngle,
          14,
          dt
        );
      }

      for (let ch = 0; ch < SSL_CHANNELS; ch++) {
        const bin = telem.freqBins[ch % 32] ?? 0;
        const chX = sslChPositions[ch];
        // Motorized SSL fader dance subtly with audio energy
        const fz = 0.56 - (telem.hasActiveAudio ? 0.08 + bin * 0.12 : 0.0);
        sslDummy.position.set(chX, 1.46 + (0.56 - fz) * 0.14, fz);
        sslDummy.rotation.set(0.14, 0, 0);
        sslDummy.scale.set(1, 1, 1);
        sslDummy.updateMatrix();
        sslFaderCaps.setMatrixAt(ch, sslDummy.matrix);

        // SSL Meter Bridge column scale
        sslDummy.position.set(chX, 1.66, -0.58);
        sslDummy.rotation.set(0.18, 0, 0);
        sslDummy.scale.set(1, Math.max(0.12, 0.15 + bin * 1.35), 1);
        sslDummy.updateMatrix();
        sslLedInstances.setMatrixAt(ch, sslDummy.matrix);
      }
      sslFaderCaps.instanceMatrix.needsUpdate = true;
      sslLedInstances.instanceMatrix.needsUpdate = true;

      // X-Ray See-Through Acoustic Walls & Abstracted Behind-Rack Transparency
      const isBehindRack =
        camera.position.z < -0.55 ||
        Math.abs(camera.position.x) > 7.2 ||
        cameraPresetRef.current === 'rear';
      const wantXRay = xRayWallsRef.current || isBehindRack;
      const targetWallOpacity = wantXRay ? 0.08 : 1.0;
      const targetWireOpacity = wantXRay ? 0.36 : 0.0;

      feltBackingMat.opacity = THREE.MathUtils.damp(
        feltBackingMat.opacity,
        targetWallOpacity,
        10,
        dt
      );
      feltBackingMat.depthWrite = feltBackingMat.opacity > 0.72;
      studioWalnutSlatMat.opacity = THREE.MathUtils.damp(
        studioWalnutSlatMat.opacity,
        wantXRay ? 0.1 : 1.0,
        10,
        dt
      );
      studioWalnutSlatMat.depthWrite = studioWalnutSlatMat.opacity > 0.72;
      xRayWireMat.opacity = THREE.MathUtils.damp(
        xRayWireMat.opacity,
        targetWireOpacity,
        10,
        dt
      );
      cloudTrim.visible = !wantXRay;
      coveLedFront.visible = !wantXRay;
      coveLedRear.visible = !wantXRay;

      const rackShellOpacity = abstractRacksRef.current ? 0.22 : 1.0;
      const rackShellDepth = !abstractRacksRef.current;
      [
        sideCheekCab1Mat,
        sideCheekCab2Mat,
        sideCheekCab3Mat,
        chassisMat,
        trimRailMat,
      ].forEach((m) => {
        m.opacity = THREE.MathUtils.damp(m.opacity, rackShellOpacity, 10, dt);
        m.depthWrite = rackShellDepth;
      });

      // Compute Camera/Rack angular sway impulse for real moving Verlet cables
      const curAzimuth = Math.atan2(camera.position.x, camera.position.z);
      let dAz = curAzimuth - prevCamAzimuth;
      if (dAz > Math.PI) dAz -= Math.PI * 2;
      if (dAz < -Math.PI) dAz += Math.PI * 2;
      prevCamAzimuth = curAzimuth;

      swayVelocity = THREE.MathUtils.damp(
        swayVelocity + THREE.MathUtils.clamp(dAz, -0.15, 0.15) * 4.5,
        0,
        5.0,
        dt
      );
      const beatKick = telem.isBeatTriggered ? 0.55 + telem.bass * 0.9 : 0;

      for (const cm of activeCableMeshes) {
        const jA = jackMap.get(cm.from);
        const jB = jackMap.get(cm.to);
        if (!jA || !jB) continue;

        const pStart = jA.worldAnchorLocal;
        const pEnd =
          cm.isDetachedTail && activeCableDrag && activeCableDrag.hasMoved
            ? activeCableDrag.loosePos
            : jB.worldAnchorLocal;

        stepVerletChain(
          cm.nodes,
          cm.prevNodes,
          cm.restLen,
          pStart,
          pEnd,
          dt,
          swayVelocity,
          beatKick,
          cm.phaseOffset,
          tSec
        );

        updateDynamicCableGeometry(cm.tubeGeo, cm.curve, 0.020);
        cm.plugA.position.copy(cm.nodes[0]);
        cm.plugB.position.copy(cm.nodes[cm.nodes.length - 1]);

        const energy = telem.cableEnergy[cm.cableId] ?? 0;
        const activeFlow = energy > 0.012 || telem.hasActiveAudio;
        const speed = 0.28 + energy * 1.65;
        const beadScale = activeFlow ? 0.55 + energy * 1.15 : 0.25;
        cm.beadMat.opacity = activeFlow ? Math.min(1, 0.4 + energy * 0.9) : 0.18;

        for (let b = 0; b < BEADS_PER_CABLE; b++) {
          const u = ((tSec * speed + b / BEADS_PER_CABLE + cm.phaseOffset) % 1 + 1) % 1;
          cm.curve.getPointAt(u, _beadPos);
          _beadObj.position.copy(_beadPos);
          _beadObj.scale.setScalar(beadScale);
          _beadObj.updateMatrix();
          cm.beads.setMatrixAt(b, _beadObj.matrix);
        }
        cm.beads.instanceMatrix.needsUpdate = true;
      }

      if (
        activeCableDrag &&
        activeCableDrag.hasMoved &&
        activeCableDrag.mode !== 'rewire_existing'
      ) {
        const dist = activeCableDrag.fixedPos.distanceTo(activeCableDrag.loosePos);
        const restLen = Math.max(dist * 1.18 + 0.18, 0.35) / (CABLE_NODE_COUNT - 1);
        stepVerletChain(
          dragNodes,
          dragPrevNodes,
          restLen,
          activeCableDrag.fixedPos,
          activeCableDrag.loosePos,
          dt,
          swayVelocity,
          0,
          0,
          tSec
        );
        updateDynamicCableGeometry(dragTubeGeo, dragCurve, 0.021);
        dragPlugLoose.position.copy(activeCableDrag.loosePos);
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(() => tick(performance.now()));
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      for (const cm of activeCableMeshes) {
        cm.tubeGeo.dispose();
        cm.tubeMat.dispose();
        cm.plugMat.dispose();
        cm.beadMat.dispose();
      }
      for (const d of disposables) {
        d.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [telemetryRef]);

  return <div ref={mountRef} className="w-full h-full relative" />;
};
