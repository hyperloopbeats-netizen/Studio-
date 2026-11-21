export type RackModuleId =
  | 'player'
  | 'amp'
  | 'compressor'
  | 'eq'
  | 'exporter'
  | 'phaseNull'
  | 'acousticSpace'
  | 'revAmp'
  | 'negMaster'
  | 'zeroDbBus'
  | 'tapeSat'
  | 'luxuryVerb'
  | 'harmonicExciter'
  | 'stereoImager'
  | 'luxuryMaster';

export type SovereignUnitId =
  | 'subGen'
  | 'tapeSat'
  | 'exciter'
  | 'transient'
  | 'vcaComp'
  | 'reverb'
  | 'limiter'
  | 'fft'
  | 'recorder';

export interface SovereignChainState {
  order: SovereignUnitId[];
  bypass: Record<SovereignUnitId, boolean>;
  subGen: {
    freqHz: number; // 35 .. 90 Hz
    drive: number; // 0 .. 1
  };
  transient: {
    attackDb: number; // -6 .. +6 dB
    sustainPct: number; // 50 .. 150 %
  };
  vcaComp: {
    threshold: number; // -30 .. 0 dB
    ratio: number; // 2 .. 10
    releaseMs: number; // 50 .. 1000 ms
    makeupGain: number; // 0.5 .. 2.0
  };
  limiter: {
    thresholdDb: number; // -12 .. 0 dB
    ceilingDb: number; // -3 .. 0 dB
  };
}

export type OutputJackId =
  | 'player_out'
  | 'amp_out'
  | 'cmp_out'
  | 'eq_out'
  | 'null_out'
  | 'spc_out'
  | 'rev_out'
  | 'ncl_out'
  | 'zdb_out'
  | 'tap_out'
  | 'lux_out'
  | 'exc_out'
  | 'img_out'
  | 'fin_out';

export type InputJackId =
  | 'amp_in'
  | 'cmp_in'
  | 'eq_in'
  | 'exp_in'
  | 'null_in'
  | 'spc_in'
  | 'rev_in'
  | 'ncl_in'
  | 'zdb_in'
  | 'tap_in'
  | 'lux_in'
  | 'exc_in'
  | 'img_in'
  | 'fin_in';

export type JackId = OutputJackId | InputJackId;

export type SensitivityPresetKey = 'bass' | 'vocal' | 'quiet';
export type WavExportFormat = '128k_8khz_16bit' | '128k_16khz_8bit' | 'studio_44k_16bit';

export type CableTone =
  | 'amber'
  | 'crimson'
  | 'cobalt'
  | 'emerald'
  | 'gold'
  | 'cyan'
  | 'violet'
  | 'magenta'
  | 'champagne'
  | 'copper'
  | 'platinum'
  | 'graphite'
  | 'ivory'
  | 'obsidian';

export interface PatchCable {
  id: string;
  from: OutputJackId;
  to: InputJackId;
  tone: CableTone;
}

export interface AcousticBandSpace {
  enabled: boolean;
  solo: boolean;
  pan: number; // -1.0 (left) .. +1.0 (right)
  spaceDepth: number; // 0.0 .. 1.0 (Haas / early reflection room separation)
  negGain: number; // -1.5 .. +1.5 (negative polarity / gain)
}

export interface RackParameters {
  player: {
    inputTrim: number; // 0.2 .. 2.0
    loop: boolean;
    sourceMode: 'file' | 'drone' | 'mic';
  };
  amp: {
    power: boolean;
    drive: number; // 0 .. 1
    bias: number; // -0.5 .. 0.5
    outputGain: number; // 0.2 .. 2.0
    hpfEnabled: boolean;
  };
  compressor: {
    power: boolean;
    hyperEnabled: boolean;
    threshold: number; // -48 .. 0 dB
    ratio: number; // 1 .. 20
    attack: number; // 0.001 .. 0.25 s
    release: number; // 0.04 .. 1.0 s
    makeupGain: number; // 0.5 .. 2.5
    preset: SensitivityPresetKey;
    beatSensitivity: number; // 1.05 .. 2.5
    autoBeatShockwaves: boolean;
    // 4-Bank x 3-Slider Hyper-Compressor Matrix (12 parameters)
    s1Floor: number;
    s1Condense: number;
    s1Round: number;
    s2Floor: number;
    s2Condense: number;
    s2Round: number;
    s3Floor: number;
    s3Condense: number;
    s3Round: number;
    s4Density: number;
    s4WaveHz: number;
    s4SpliceRound: number;
  };
  eq: {
    power: boolean;
    lowGain: number; // -12 .. +12 dB (60 Hz)
    lowMidGain: number; // -12 .. +12 dB (350 Hz)
    highMidGain: number; // -12 .. +12 dB (2.4 kHz)
    highGain: number; // -12 .. +12 dB (10 kHz)
    presenceQ: number; // 0.4 .. 4.0
  };
  exporter: {
    format: WavExportFormat;
    normalize: boolean;
    dither: boolean;
    masterVolume: number; // 0.0 .. 1.5
  };
  // --- Cabinet II: Negative Cancellation, Acoustic Space Separation & True-0dB Silence Mastering ---
  phaseNull: {
    power: boolean;
    polarityInvert: boolean;
    cancelDepth: number; // 0.0 .. 1.0
    nullFloor: number; // 0.002 .. 0.25
    zeroDbFocus: number; // 0.0 .. 1.0
  };
  acousticSpace: {
    power: boolean;
    roomWidth: number; // 0.0 .. 1.5
    low: AcousticBandSpace; // < 180 Hz
    lowMid: AcousticBandSpace; // 180 - 900 Hz
    highMid: AcousticBandSpace; // 900 - 4200 Hz
    high: AcousticBandSpace; // > 4200 Hz
  };
  revAmp: {
    power: boolean;
    reverseFreq: number; // 0.0 .. 1.0
    negAmpGainDb: number; // 0.0 .. 24.0 dB
    mirrorPivotHz: number; // 200 .. 6000 Hz
    trueZeroClamp: boolean;
  };
  negMaster: {
    power: boolean;
    gateInvert: boolean;
    negThreshold: number; // -60 .. -3 dB
    invRatio: number; // 1.0 .. 20.0
    silenceLift: number; // 0.0 .. 1.0
    gateFloorDb: number; // -72 .. -12 dB
    limiterCeilingDb: number; // -3.0 .. 0.0 dB
  };
  zeroDbBus: {
    power: boolean;
    trueZeroLock: boolean;
    phaseCoherence: number; // -1.0 .. 1.0
    busTrim: number; // 0.2 .. 1.5
  };
  // --- Cabinet III: Luxury Analog Tape, Ambient Hall Reverb, Harmonic Exciter & M/S Reference ---
  tapeSat: {
    power: boolean;
    warmth: number; // 0.0 .. 1.0
    saturation: number; // 0.0 .. 1.0
    wowFlutter: number; // 0.0 .. 1.0
    ips30: boolean; // true = 30 IPS studio mastering speed, false = 15 IPS warm head bump
  };
  luxuryVerb: {
    power: boolean;
    mix: number; // 0.0 .. 0.85
    decaySec: number; // 0.5 .. 5.5 s
    preDelayMs: number; // 0 .. 100 ms
    shimmer: number; // 0.0 .. 1.0
    stereoSpread: boolean;
  };
  harmonicExciter: {
    power: boolean;
    tuneHz: number; // 1500 .. 8000 Hz
    harmonics: number; // 0.0 .. 1.0
    subPunch: number; // 0.0 .. 1.0
    airGainDb: number; // 0.0 .. 10.0 dB
    tubeOddEven: boolean;
  };
  stereoImager: {
    power: boolean;
    width: number; // 0.0 .. 2.0
    lowMonoHz: number; // 40 .. 240 Hz
    midGainDb: number; // -6.0 .. +6.0 dB
    sideGainDb: number; // -6.0 .. +6.0 dB
    msSolo: boolean;
  };
  luxuryMaster: {
    power: boolean;
    ceilingDb: number; // -3.0 .. 0.0 dB
    analogGlow: number; // 0.0 .. 1.0
    dimSwitch: boolean; // -12 dB reference dim
    monoCheck: boolean;
  };
  masterPower: boolean;
  sovereignChain: SovereignChainState;
}

export interface AudioTelemetry {
  bass: number;
  mid: number;
  treble: number;
  rms: number;
  peak: number;
  isSilentGap: boolean;
  gapCondensePct: number;
  waveRoundVal: number;
  sonicSegmentCount: number;
  beatCount: number;
  beatEnergy: number;
  effectiveThreshold: number;
  isBeatTriggered: boolean;
  freqBins: number[]; // 32 normalized bins
  envTrace: number[]; // 64 samples
  cableEnergy: Record<string, number>; // cableId -> 0..1 normalized signal energy
  moduleLevels: Record<RackModuleId, number>; // 0..1 meter level
  hasActiveAudio: boolean;
  // Cabinet II Telemetry
  silenceAmpDb: number; // -72 .. 0.0 dBFS
  trueZeroProximity: number; // 0 .. 1
  negLiftDb: number; // 0 .. +24 dB active negative amplification
  bandSpaceLevels: [number, number, number, number]; // Low, LowMid, HighMid, High
  // Cabinet III Telemetry
  tapeSaturationPct: number; // 0 .. 100
  luxRoomLevel: number; // 0 .. 1
  stereoCorrelation: number; // -1 .. +1
  // AIM SSL & Sovereign Telemetry
  sslVcaGrDb: number; // 0 .. 18 dB reduction
}

export type DragonflyDivision =
  | 'Signal Topology'
  | 'Harmonic Tube'
  | 'Hyper-Gap Dynamics'
  | 'Mastering EQ'
  | 'Codec & Telemetry';

export interface DragonflyArchitect {
  id: string;
  codename: string;
  division: DragonflyDivision;
  specialization: string;
  weight: number;
  status: 'active' | 'indexing' | 'calibrated';
}

export interface StudioPresetEntry {
  id: string;
  name: string;
  authorSquad: string;
  description: string;
  createdAt: string;
  cables: PatchCable[];
  params: RackParameters;
}

export interface StudioJsonLibrary {
  schemaVersion: string;
  libraryName: string;
  updatedAt: string;
  checksum: string;
  architectCount: number;
  architectManifest: {
    divisions: Record<DragonflyDivision, number>;
    indexLatencyMs: number;
  };
  presets: StudioPresetEntry[];
  activePresetId: string;
  routingTemplates: Array<{
    id: string;
    label: string;
    cables: PatchCable[];
  }>;
  driveSyncMeta: {
    fileId: string | null;
    fileName: string;
    lastSyncedAt: string | null;
  };
}

export type DaemonCategory =
  | 'Audio Transient'
  | 'Silence Condenser'
  | 'Gain Guard'
  | 'Cable Physics'
  | 'Drive Sync'
  | 'AI Bridge';

export interface EventDaemon {
  id: string;
  name: string;
  category: DaemonCategory;
  subscribedEvent: string;
  executions: number;
  active: boolean;
  lastTriggeredAt: number | null;
}

export interface StudioEvent {
  id: string;
  type: string;
  source: string;
  daemonId: string;
  summary: string;
  timestamp: number;
}

export interface AiEngineerHistoryEntry {
  role: 'user' | 'engineer';
  text: string;
}

export interface AiEngineerPassRecord {
  id: string;
  prompt: string;
  presetName: string;
  summary: string;
  signalChainRationale?: string;
  appliedElements: string[];
  timestamp: number;
}

export interface MainAiDirectiveResponse {
  summary: string;
  presetName: string;
  signalChainRationale?: string;
  appliedElements?: string[];
  daemonMode?: string;
  masterPower?: boolean;
  player?: Partial<RackParameters['player']>;
  amp?: Partial<RackParameters['amp']>;
  compressor?: {
    power?: boolean;
    hyperEnabled?: boolean;
    threshold?: number;
    ratio?: number;
    attack?: number;
    release?: number;
    makeupGain?: number;
    preset?: SensitivityPresetKey;
    beatSensitivity?: number;
    autoBeatShockwaves?: boolean;
    gapCondense?: number;
    waveRound?: number;
    silenceFloor?: number;
    dynamicDensity?: number;
    waveFreqHz?: number;
    s1Floor?: number;
    s1Condense?: number;
    s1Round?: number;
    s2Floor?: number;
    s2Condense?: number;
    s2Round?: number;
    s3Floor?: number;
    s3Condense?: number;
    s3Round?: number;
    s4Density?: number;
    s4WaveHz?: number;
    s4SpliceRound?: number;
  };
  eq?: Partial<RackParameters['eq']>;
  exporter?: {
    format?: WavExportFormat;
    normalize?: boolean;
    dither?: boolean;
    masterVolume?: number;
  };
  phaseNull?: Partial<RackParameters['phaseNull']>;
  acousticSpace?: {
    power?: boolean;
    roomWidth?: number;
    low?: Partial<AcousticBandSpace>;
    lowMid?: Partial<AcousticBandSpace>;
    highMid?: Partial<AcousticBandSpace>;
    high?: Partial<AcousticBandSpace>;
  };
  revAmp?: Partial<RackParameters['revAmp']>;
  negMaster?: Partial<RackParameters['negMaster']>;
  zeroDbBus?: Partial<RackParameters['zeroDbBus']>;
  tapeSat?: Partial<RackParameters['tapeSat']>;
  luxuryVerb?: Partial<RackParameters['luxuryVerb']>;
  harmonicExciter?: Partial<RackParameters['harmonicExciter']>;
  stereoImager?: Partial<RackParameters['stereoImager']>;
  luxuryMaster?: Partial<RackParameters['luxuryMaster']>;
  sovereignChain?: {
    order?: SovereignUnitId[];
    bypass?: Partial<Record<SovereignUnitId, boolean>>;
    subGen?: Partial<SovereignChainState['subGen']>;
    transient?: Partial<SovereignChainState['transient']>;
    vcaComp?: Partial<SovereignChainState['vcaComp']>;
    limiter?: Partial<SovereignChainState['limiter']>;
  };
  daemonAutomation?: {
    automationEnabled?: boolean;
    autoGainGuard?: boolean;
  };
  studioView?: {
    xRayWalls?: boolean;
    abstractRacks?: boolean;
    showFractal?: boolean;
  };
  cables?: Array<{ from: OutputJackId; to: InputJackId }>;
}

export interface SelectedControlInfo {
  moduleId: RackModuleId;
  controlId: string;
  label: string;
  formattedValue: string;
}

export interface NarrationInjectionStep {
  id: string;
  phase: string;
  title: string;
  targetModule: string;
  narration: string;
  codeSignature: string;
  status: 'pending' | 'injecting' | 'verified';
  verifiedAt: number | null;
}

