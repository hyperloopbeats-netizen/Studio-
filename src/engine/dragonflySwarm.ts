import {
  DragonflyArchitect,
  DragonflyDivision,
  PatchCable,
  RackParameters,
  StudioJsonLibrary,
  StudioPresetEntry,
} from '../types/studio';

export const DEFAULT_CABLES: PatchCable[] = [
  { id: 'c-1', from: 'player_out', to: 'amp_in', tone: 'amber' },
  { id: 'c-2', from: 'amp_out', to: 'cmp_in', tone: 'crimson' },
  { id: 'c-3', from: 'cmp_out', to: 'eq_in', tone: 'cobalt' },
  { id: 'c-4', from: 'eq_out', to: 'null_in', tone: 'cyan' },
  { id: 'c-5', from: 'null_out', to: 'spc_in', tone: 'violet' },
  { id: 'c-6', from: 'spc_out', to: 'rev_in', tone: 'emerald' },
  { id: 'c-7', from: 'rev_out', to: 'ncl_in', tone: 'magenta' },
  { id: 'c-8', from: 'ncl_out', to: 'zdb_in', tone: 'gold' },
  { id: 'c-9', from: 'zdb_out', to: 'tap_in', tone: 'champagne' },
  { id: 'c-10', from: 'tap_out', to: 'lux_in', tone: 'copper' },
  { id: 'c-11', from: 'lux_out', to: 'exc_in', tone: 'amber' },
  { id: 'c-12', from: 'exc_out', to: 'img_in', tone: 'cyan' },
  { id: 'c-13', from: 'img_out', to: 'fin_in', tone: 'gold' },
  { id: 'c-14', from: 'fin_out', to: 'exp_in', tone: 'platinum' },
];

export const DEFAULT_RACK_PARAMETERS: RackParameters = {
  player: {
    inputTrim: 1.0,
    loop: true,
    sourceMode: 'file',
  },
  amp: {
    power: true,
    drive: 0.28,
    bias: 0.08,
    outputGain: 1.05,
    hpfEnabled: false,
  },
  compressor: {
    power: true,
    hyperEnabled: true,
    threshold: -18,
    ratio: 4.0,
    attack: 0.012,
    release: 0.18,
    makeupGain: 1.15,
    preset: 'bass',
    beatSensitivity: 1.4,
    autoBeatShockwaves: true,
    s1Floor: 0.045,
    s1Condense: 0.75,
    s1Round: 0.65,
    s2Floor: 0.035,
    s2Condense: 0.70,
    s2Round: 0.60,
    s3Floor: 0.025,
    s3Condense: 0.65,
    s3Round: 0.70,
    s4Density: 0.60,
    s4WaveHz: 6.5,
    s4SpliceRound: 0.80,
  },
  eq: {
    power: true,
    lowGain: 1.8,
    lowMidGain: -1.2,
    highMidGain: 1.5,
    highGain: 2.2,
    presenceQ: 1.2,
  },
  exporter: {
    format: '128k_8khz_16bit',
    normalize: true,
    dither: true,
    masterVolume: 1.0,
  },
  phaseNull: {
    power: true,
    polarityInvert: false,
    cancelDepth: 0.15,
    nullFloor: 0.032,
    zeroDbFocus: 0.55,
  },
  acousticSpace: {
    power: true,
    roomWidth: 1.0,
    low: {
      enabled: true,
      solo: false,
      pan: -0.12,
      spaceDepth: 0.18,
      negGain: 1.0,
    },
    lowMid: {
      enabled: true,
      solo: false,
      pan: 0.28,
      spaceDepth: 0.34,
      negGain: 0.96,
    },
    highMid: {
      enabled: true,
      solo: false,
      pan: -0.34,
      spaceDepth: 0.45,
      negGain: 1.02,
    },
    high: {
      enabled: true,
      solo: false,
      pan: 0.48,
      spaceDepth: 0.58,
      negGain: 1.04,
    },
  },
  revAmp: {
    power: true,
    reverseFreq: 0.28,
    negAmpGainDb: 8.0,
    mirrorPivotHz: 1400,
    trueZeroClamp: true,
  },
  negMaster: {
    power: true,
    gateInvert: true,
    negThreshold: -32,
    invRatio: 4.5,
    silenceLift: 0.55,
    gateFloorDb: -56,
    limiterCeilingDb: -0.2,
  },
  zeroDbBus: {
    power: true,
    trueZeroLock: true,
    phaseCoherence: 0.15,
    busTrim: 1.02,
  },
  tapeSat: {
    power: true,
    warmth: 0.45,
    saturation: 0.32,
    wowFlutter: 0.12,
    ips30: true,
  },
  luxuryVerb: {
    power: true,
    mix: 0.22,
    decaySec: 2.4,
    preDelayMs: 24,
    shimmer: 0.35,
    stereoSpread: true,
  },
  harmonicExciter: {
    power: true,
    tuneHz: 3400,
    harmonics: 0.36,
    subPunch: 0.28,
    airGainDb: 2.4,
    tubeOddEven: true,
  },
  stereoImager: {
    power: true,
    width: 1.18,
    lowMonoHz: 110,
    midGainDb: 0.5,
    sideGainDb: 1.2,
    msSolo: false,
  },
  luxuryMaster: {
    power: true,
    ceilingDb: -0.2,
    analogGlow: 0.42,
    dimSwitch: false,
    monoCheck: false,
  },
  masterPower: true,
  sovereignChain: {
    order: [
      'subGen',
      'tapeSat',
      'exciter',
      'transient',
      'vcaComp',
      'reverb',
      'limiter',
      'fft',
      'recorder',
    ],
    bypass: {
      subGen: false,
      tapeSat: false,
      exciter: false,
      transient: false,
      vcaComp: false,
      reverb: false,
      limiter: false,
      fft: false,
      recorder: false,
    },
    subGen: {
      freqHz: 55,
      drive: 0.4,
    },
    transient: {
      attackDb: 2.0,
      sustainPct: 100,
    },
    vcaComp: {
      threshold: -18,
      ratio: 4,
      releaseMs: 100,
      makeupGain: 1.05,
    },
    limiter: {
      thresholdDb: -0.5,
      ceilingDb: -0.2,
    },
  },
};

const DIVISIONS: DragonflyDivision[] = [
  'Signal Topology',
  'Harmonic Tube',
  'Hyper-Gap Dynamics',
  'Mastering EQ',
  'Codec & Telemetry',
];

const SPECIALIZATIONS: Record<DragonflyDivision, string[]> = {
  'Signal Topology': [
    'Dual-Cabinet Bus Router',
    'DAG Cycle Verifier',
    'Acoustic Space Panner',
    'Phase Coherence Solver',
  ],
  'Harmonic Tube': [
    'Triode Saturation Curves',
    'Negative Polarity Inverter',
    'Anti-Phase Null Canceller',
    'Cryo Tube Silence Modeler',
  ],
  'Hyper-Gap Dynamics': [
    'Silence-Floor Estimator',
    'Reversed-Frequency Amplifier',
    'Inverse Gate / 0dB Limiter',
    'Beat Transient Detector',
  ],
  'Mastering EQ': [
    '4-Band Crossover Splitter',
    'Early-Reflection Delay Matrix',
    'Spectral Mirror Pivoter',
    '10kHz Air Shelf Balancer',
  ],
  'Codec & Telemetry': [
    '128kbps PCM Resampler',
    'True-0dB Headroom Anchor',
    'JSON Index Hasher',
    'Drive Chunk Serializer',
  ],
};

function computeChecksum(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function mergeWithDefaults(partial: Partial<RackParameters> | undefined): RackParameters {
  const base = JSON.parse(JSON.stringify(DEFAULT_RACK_PARAMETERS)) as RackParameters;
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    player: { ...base.player, ...(partial.player ?? {}) },
    amp: { ...base.amp, ...(partial.amp ?? {}) },
    compressor: { ...base.compressor, ...(partial.compressor ?? {}) },
    eq: { ...base.eq, ...(partial.eq ?? {}) },
    exporter: { ...base.exporter, ...(partial.exporter ?? {}) },
    phaseNull: { ...base.phaseNull, ...(partial.phaseNull ?? {}) },
    acousticSpace: {
      ...base.acousticSpace,
      ...(partial.acousticSpace ?? {}),
      low: { ...base.acousticSpace.low, ...(partial.acousticSpace?.low ?? {}) },
      lowMid: { ...base.acousticSpace.lowMid, ...(partial.acousticSpace?.lowMid ?? {}) },
      highMid: { ...base.acousticSpace.highMid, ...(partial.acousticSpace?.highMid ?? {}) },
      high: { ...base.acousticSpace.high, ...(partial.acousticSpace?.high ?? {}) },
    },
    revAmp: { ...base.revAmp, ...(partial.revAmp ?? {}) },
    negMaster: { ...base.negMaster, ...(partial.negMaster ?? {}) },
    zeroDbBus: { ...base.zeroDbBus, ...(partial.zeroDbBus ?? {}) },
    tapeSat: { ...base.tapeSat, ...(partial.tapeSat ?? {}) },
    luxuryVerb: { ...base.luxuryVerb, ...(partial.luxuryVerb ?? {}) },
    harmonicExciter: { ...base.harmonicExciter, ...(partial.harmonicExciter ?? {}) },
    stereoImager: { ...base.stereoImager, ...(partial.stereoImager ?? {}) },
    luxuryMaster: { ...base.luxuryMaster, ...(partial.luxuryMaster ?? {}) },
    masterPower: partial.masterPower ?? base.masterPower,
    sovereignChain: {
      ...base.sovereignChain,
      ...(partial.sovereignChain ?? {}),
      order:
        partial.sovereignChain?.order && partial.sovereignChain.order.length === 9
          ? [...partial.sovereignChain.order]
          : [...base.sovereignChain.order],
      bypass: {
        ...base.sovereignChain.bypass,
        ...(partial.sovereignChain?.bypass ?? {}),
      },
      subGen: {
        ...base.sovereignChain.subGen,
        ...(partial.sovereignChain?.subGen ?? {}),
      },
      transient: {
        ...base.sovereignChain.transient,
        ...(partial.sovereignChain?.transient ?? {}),
      },
      vcaComp: {
        ...base.sovereignChain.vcaComp,
        ...(partial.sovereignChain?.vcaComp ?? {}),
      },
      limiter: {
        ...base.sovereignChain.limiter,
        ...(partial.sovereignChain?.limiter ?? {}),
      },
    },
  };
}

export class DragonflySwarm {
  public readonly architects: DragonflyArchitect[];
  private library: StudioJsonLibrary;
  private presetIndex: Map<string, StudioPresetEntry> = new Map();

  constructor() {
    this.architects = this.assembleSwarm();
    this.library = this.buildInitialLibrary();
    this.rebuildIndex();
  }

  private assembleSwarm(): DragonflyArchitect[] {
    const swarm: DragonflyArchitect[] = [];
    for (let i = 0; i < 100; i++) {
      const divIndex = Math.floor(i / 20);
      const division = DIVISIONS[divIndex];
      const specs = SPECIALIZATIONS[division];
      const num = String(i + 1).padStart(3, '0');
      swarm.push({
        id: `DF-${num}`,
        codename: `Anisoptera-${num}`,
        division,
        specialization: specs[i % specs.length],
        weight: Number((0.85 + ((i * 7) % 15) * 0.01).toFixed(2)),
        status: 'calibrated',
      });
    }
    return swarm;
  }

  private cloneParams(p: RackParameters): RackParameters {
    return JSON.parse(JSON.stringify(p)) as RackParameters;
  }

  private buildInitialLibrary(): StudioJsonLibrary {
    const t0 = performance.now();
    const presets: StudioPresetEntry[] = [
      {
        id: 'tri-cabinet-luxury-master',
        name: 'Tri-Cabinet Luxury Mastering Suite',
        authorSquad: 'DF-001..100 (Tri-Cabinet Architecture)',
        description:
          'Routes Cabinet I (Tube/Hyper-Cmp/EQ) -> Cabinet II (Null/4-Space/True-0dB) -> Cabinet III (Tape/Luxury Hall/Exciter/M-S Imager) for spacious velvet clarity.',
        createdAt: new Date().toISOString(),
        cables: DEFAULT_CABLES.map((c) => ({ ...c })),
        params: this.cloneParams(DEFAULT_RACK_PARAMETERS),
      },
      {
        id: 'max-silence-reversal',
        name: 'Reversed-Frequency Silence Lift',
        authorSquad: 'DF-041..080 (Reversed-Freq & Negative Master)',
        description:
          'Deep -180° phase cancellation + 18dB negative silence amplification with wide 4-band spatial dispersion and 0.0 dB brickwall ceiling.',
        createdAt: new Date().toISOString(),
        cables: DEFAULT_CABLES.map((c) => ({ ...c })),
        params: {
          ...this.cloneParams(DEFAULT_RACK_PARAMETERS),
          phaseNull: {
            power: true,
            polarityInvert: true,
            cancelDepth: 0.64,
            nullFloor: 0.065,
            zeroDbFocus: 0.92,
          },
          acousticSpace: {
            power: true,
            roomWidth: 1.35,
            low: { enabled: true, solo: false, pan: -0.35, spaceDepth: 0.35, negGain: -1.1 },
            lowMid: { enabled: true, solo: false, pan: 0.65, spaceDepth: 0.68, negGain: 1.0 },
            highMid: { enabled: true, solo: false, pan: -0.78, spaceDepth: 0.85, negGain: -1.15 },
            high: { enabled: true, solo: false, pan: 0.88, spaceDepth: 0.95, negGain: 1.2 },
          },
          revAmp: {
            power: true,
            reverseFreq: 0.88,
            negAmpGainDb: 18.5,
            mirrorPivotHz: 1850,
            trueZeroClamp: true,
          },
          negMaster: {
            power: true,
            gateInvert: true,
            negThreshold: -22,
            invRatio: 11.5,
            silenceLift: 0.92,
            gateFloorDb: -46,
            limiterCeilingDb: 0.0,
          },
        },
      },
      {
        id: 'neumann-vocal-hyper',
        name: 'Neumann Vocal + Negative Gate',
        authorSquad: 'DF-041..080 (Hyper-Gap & EQ)',
        description:
          'Tightens vocal pauses in Cabinet I while Cabinet II isolates breath rooms and keeps ambient silence anchored cleanly.',
        createdAt: new Date().toISOString(),
        cables: DEFAULT_CABLES.map((c) => ({ ...c })),
        params: {
          ...this.cloneParams(DEFAULT_RACK_PARAMETERS),
          amp: { power: true, drive: 0.18, bias: 0.12, outputGain: 1.1, hpfEnabled: true },
          compressor: {
            ...DEFAULT_RACK_PARAMETERS.compressor,
            preset: 'vocal',
            threshold: -22,
            ratio: 3.5,
            beatSensitivity: 1.22,
            s1Floor: 0.03,
            s1Condense: 0.82,
            s2Floor: 0.025,
            s2Condense: 0.85,
            s4SpliceRound: 0.9,
          },
          eq: {
            power: true,
            lowGain: -2.0,
            lowMidGain: -2.5,
            highMidGain: 3.6,
            highGain: 3.2,
            presenceQ: 1.45,
          },
          phaseNull: {
            power: true,
            polarityInvert: false,
            cancelDepth: 0.22,
            nullFloor: 0.028,
            zeroDbFocus: 0.55,
          },
          revAmp: {
            power: true,
            reverseFreq: 0.42,
            negAmpGainDb: 8.5,
            mirrorPivotHz: 2400,
            trueZeroClamp: true,
          },
        },
      },
      {
        id: 'cab1-classic-serial',
        name: 'Cabinet I Analog Only (Bypass Cab II)',
        authorSquad: 'DF-001..040 (Classic Analog)',
        description:
          'Routes exclusively through Cabinet I (MP3 → Amp → Hyper-Cmp → EQ → Exporter) for classic analog A/B comparison.',
        createdAt: new Date().toISOString(),
        cables: [
          { id: 'c-1', from: 'player_out', to: 'amp_in', tone: 'amber' },
          { id: 'c-2', from: 'amp_out', to: 'cmp_in', tone: 'crimson' },
          { id: 'c-3', from: 'cmp_out', to: 'eq_in', tone: 'cobalt' },
          { id: 'c-4', from: 'eq_out', to: 'exp_in', tone: 'emerald' },
        ],
        params: this.cloneParams(DEFAULT_RACK_PARAMETERS),
      },
      {
        id: 'clean-reference',
        name: 'Pure Direct Reference',
        authorSquad: 'DF-081..100 (Codec & Telemetry)',
        description:
          'Direct player-to-exporter path with all coloration bypassed for A/B 128k comparison.',
        createdAt: new Date().toISOString(),
        cables: [{ id: 'c-direct', from: 'player_out', to: 'exp_in', tone: 'gold' }],
        params: {
          ...this.cloneParams(DEFAULT_RACK_PARAMETERS),
          amp: { ...DEFAULT_RACK_PARAMETERS.amp, power: false, drive: 0, bias: 0, outputGain: 1 },
          compressor: { ...DEFAULT_RACK_PARAMETERS.compressor, power: false, hyperEnabled: false },
          eq: {
            ...DEFAULT_RACK_PARAMETERS.eq,
            power: false,
            lowGain: 0,
            lowMidGain: 0,
            highMidGain: 0,
            highGain: 0,
          },
        },
      },
    ];

    const divisions: Record<DragonflyDivision, number> = {
      'Signal Topology': 20,
      'Harmonic Tube': 20,
      'Hyper-Gap Dynamics': 20,
      'Mastering EQ': 20,
      'Codec & Telemetry': 20,
    };

    const rawBody = JSON.stringify(presets);
    const t1 = performance.now();

    return {
      schemaVersion: '3.0.0',
      libraryName: 'monolith_studio_library.json',
      updatedAt: new Date().toISOString(),
      checksum: computeChecksum(rawBody),
      architectCount: this.architects.length,
      architectManifest: {
        divisions,
        indexLatencyMs: Number((t1 - t0).toFixed(2)),
      },
      presets,
      activePresetId: presets[0].id,
      routingTemplates: [
        {
          id: 'tri-cabinet-luxury',
          label: 'Tri-Cab Full: Cab I -> Cab II (0dB) -> Cab III (Tape/Lux/M-S)',
          cables: DEFAULT_CABLES.map((c) => ({ ...c })),
        },
        {
          id: 'cab1-cab3-warm-master',
          label: 'Luxury Studio: Cab I -> Tape -> Hall -> Exciter -> Imager -> Fin',
          cables: [
            { id: 'c-1', from: 'player_out', to: 'amp_in', tone: 'amber' },
            { id: 'c-2', from: 'amp_out', to: 'cmp_in', tone: 'crimson' },
            { id: 'c-3', from: 'cmp_out', to: 'eq_in', tone: 'cobalt' },
            { id: 'c-4', from: 'eq_out', to: 'tap_in', tone: 'champagne' },
            { id: 'c-5', from: 'tap_out', to: 'lux_in', tone: 'copper' },
            { id: 'c-6', from: 'lux_out', to: 'exc_in', tone: 'amber' },
            { id: 'c-7', from: 'exc_out', to: 'img_in', tone: 'cyan' },
            { id: 'c-8', from: 'img_out', to: 'fin_in', tone: 'gold' },
            { id: 'c-9', from: 'fin_out', to: 'exp_in', tone: 'platinum' },
          ],
        },
        {
          id: 'cab2-silence-direct',
          label: 'Cab II Silence Amp: Player -> INV -> Space -> REV -> NCL -> ZDB -> Exp',
          cables: [
            { id: 'c-1', from: 'player_out', to: 'null_in', tone: 'cyan' },
            { id: 'c-2', from: 'null_out', to: 'spc_in', tone: 'violet' },
            { id: 'c-3', from: 'spc_out', to: 'rev_in', tone: 'emerald' },
            { id: 'c-4', from: 'rev_out', to: 'ncl_in', tone: 'magenta' },
            { id: 'c-5', from: 'ncl_out', to: 'zdb_in', tone: 'gold' },
            { id: 'c-6', from: 'zdb_out', to: 'exp_in', tone: 'platinum' },
          ],
        },
        {
          id: 'cab1-serial-only',
          label: 'Cab I Only: Player -> Amp -> Cmp -> EQ -> Exp',
          cables: [
            { id: 'c-1', from: 'player_out', to: 'amp_in', tone: 'amber' },
            { id: 'c-2', from: 'amp_out', to: 'cmp_in', tone: 'crimson' },
            { id: 'c-3', from: 'cmp_out', to: 'eq_in', tone: 'cobalt' },
            { id: 'c-4', from: 'eq_out', to: 'exp_in', tone: 'emerald' },
          ],
        },
      ],
      driveSyncMeta: {
        fileId: null,
        fileName: 'monolith_studio_library.json',
        lastSyncedAt: null,
      },
    };
  }

  private rebuildIndex() {
    this.presetIndex.clear();
    for (const preset of this.library.presets) {
      this.presetIndex.set(preset.id, preset);
    }
    this.library.checksum = computeChecksum(JSON.stringify(this.library.presets));
    this.library.updatedAt = new Date().toISOString();
  }

  public getLibrary(): StudioJsonLibrary {
    return this.library;
  }

  public getPresetFast(id: string): StudioPresetEntry | undefined {
    return this.presetIndex.get(id);
  }

  public upsertPreset(entry: StudioPresetEntry): StudioJsonLibrary {
    const idx = this.library.presets.findIndex((p) => p.id === entry.id);
    if (idx >= 0) {
      this.library.presets[idx] = entry;
    } else {
      this.library.presets.unshift(entry);
    }
    this.library.activePresetId = entry.id;
    this.rebuildIndex();
    return this.library;
  }

  public setActivePresetId(id: string) {
    if (this.presetIndex.has(id)) {
      this.library.activePresetId = id;
    }
  }

  public deletePreset(id: string): StudioJsonLibrary {
    if (this.library.presets.length <= 1) return this.library;
    this.library.presets = this.library.presets.filter((p) => p.id !== id);
    if (this.library.activePresetId === id) {
      this.library.activePresetId = this.library.presets[0].id;
    }
    this.rebuildIndex();
    return this.library;
  }

  public recalibrateSwarm(): StudioJsonLibrary {
    const t0 = performance.now();
    for (const arch of this.architects) {
      arch.status = 'calibrated';
    }
    this.rebuildIndex();
    const t1 = performance.now();
    this.library.architectManifest.indexLatencyMs = Number(
      Math.max(0.05, t1 - t0).toFixed(2)
    );
    return this.library;
  }

  public hydrateFromDrive(remoteLib: StudioJsonLibrary, fileId: string): StudioJsonLibrary {
    const normalizedPresets = (remoteLib.presets || []).map((p) => ({
      ...p,
      params: mergeWithDefaults(p.params),
    }));
    this.library = {
      ...remoteLib,
      presets: normalizedPresets.length > 0 ? normalizedPresets : this.library.presets,
      architectCount: 100,
      driveSyncMeta: {
        fileId,
        fileName: remoteLib.driveSyncMeta?.fileName || 'monolith_studio_library.json',
        lastSyncedAt: new Date().toISOString(),
      },
    };
    this.rebuildIndex();
    return this.library;
  }

  public markDriveSynced(fileId: string): StudioJsonLibrary {
    this.library.driveSyncMeta = {
      fileId,
      fileName: this.library.libraryName,
      lastSyncedAt: new Date().toISOString(),
    };
    return this.library;
  }
}
