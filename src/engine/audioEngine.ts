import {
  AcousticBandSpace,
  AudioTelemetry,
  InputJackId,
  OutputJackId,
  PatchCable,
  RackModuleId,
  RackParameters,
  SensitivityPresetKey,
  SovereignUnitId,
  WavExportFormat,
} from '../types/studio';
import { DEFAULT_CABLES, DEFAULT_RACK_PARAMETERS } from './dragonflySwarm';

export const SENSITIVITY_PRESETS: Record<
  SensitivityPresetKey,
  {
    label: string;
    hint: string;
    minFloor: number;
    sensitivity: number;
    cooldown: number;
    bassWeight: number;
    midWeight: number;
  }
> = {
  bass: {
    label: 'BASS CLUB',
    hint: 'SUB 20-150Hz',
    minFloor: 0.15,
    sensitivity: 1.4,
    cooldown: 0.25,
    bassWeight: 1.0,
    midWeight: 0.15,
  },
  vocal: {
    label: 'VOCAL / VOICE',
    hint: 'VOICE + MID',
    minFloor: 0.08,
    sensitivity: 1.22,
    cooldown: 0.19,
    bassWeight: 0.45,
    midWeight: 0.85,
  },
  quiet: {
    label: 'QUIET ROOM',
    hint: 'LOW-GAIN MIC',
    minFloor: 0.035,
    sensitivity: 1.15,
    cooldown: 0.22,
    bassWeight: 0.65,
    midWeight: 0.65,
  },
};

function createTubeCurve(drive: number, bias: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  const k = 1 + drive * 28;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1 + bias * 0.35;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function createZeroDbLimiterCurve(ceilingLin: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  const ceil = Math.max(0.5, Math.min(1.0, ceilingLin));
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const ax = Math.abs(x);
    if (ax <= ceil * 0.92) {
      curve[i] = x;
    } else {
      const over = ax - ceil * 0.92;
      const soft = ceil * 0.92 + Math.tanh(over * 8) * (ceil * 0.08);
      curve[i] = Math.sign(x) * Math.min(ceil, soft);
    }
  }
  return curve;
}

function createTapeSaturationCurve(sat: number, warmth: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  const drive = 1 + sat * 2.6;
  const asym = warmth * 0.06;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const driven = x * drive + asym;
    curve[i] = Math.tanh(driven) / Math.tanh(drive) - Math.tanh(asym) / Math.tanh(drive);
  }
  return curve;
}

function createExciterCurve(harmonics: number, tubeOddEven: boolean): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  const amt = harmonics * 4.5;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const harmonicTerm = tubeOddEven
      ? x + amt * 0.14 * (x * x - 0.15)
      : Math.tanh(x * (1 + amt));
    curve[i] = Math.max(-1, Math.min(1, harmonicTerm));
  }
  return curve;
}

function createLuxuryHallIR(
  ctx: BaseAudioContext,
  decaySec: number,
  shimmer: number,
  stereoSpread: boolean
): AudioBuffer {
  const sr = ctx.sampleRate;
  const clampedDecay = Math.max(0.4, Math.min(5.5, decaySec));
  const length = Math.max(1024, Math.floor(sr * clampedDecay));
  const buf = ctx.createBuffer(2, length, sr);
  const chL = buf.getChannelData(0);
  const chR = buf.getChannelData(1);

  // Subtle velvet dark-to-shimmer damping envelope
  let lpL = 0;
  let lpR = 0;
  const damp = Math.min(0.92, 0.25 + shimmer * 0.65);
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const env = Math.pow(1 - t, 2.4) * Math.exp(-t * 3.2);
    const nL = Math.random() * 2 - 1;
    const nR = stereoSpread ? Math.random() * 2 - 1 : nL;
    lpL = lpL * (1 - damp) + nL * damp;
    lpR = lpR * (1 - damp) + nR * damp;
    chL[i] = lpL * env * 0.45;
    chR[i] = lpR * env * 0.45;
  }
  return buf;
}

function encodeWavBuffer(
  monoOrStereo: Float32Array[],
  sampleRate: number,
  bitsPerSample: 8 | 16,
  dither: boolean
): Blob {
  const numChannels = monoOrStereo.length;
  const numFrames = monoOrStereo[0].length;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let s = Math.max(-1, Math.min(1, monoOrStereo[ch][i]));
      if (dither) {
        const lsb = bitsPerSample === 8 ? 1 / 128 : 1 / 32768;
        s += (Math.random() - Math.random()) * lsb;
        s = Math.max(-1, Math.min(1, s));
      }
      if (bitsPerSample === 8) {
        const u8 = Math.max(0, Math.min(255, Math.round((s + 1) * 127.5)));
        view.setUint8(offset, u8);
        offset += 1;
      } else {
        const i16 = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
        view.setInt16(offset, i16, true);
        offset += 2;
      }
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function resampleChannel(
  input: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

interface AcousticBandNodes {
  filter: BiquadFilterNode;
  delay: DelayNode;
  panner: StereoPannerNode;
  gain: GainNode;
  analyser: AnalyserNode;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private params: RackParameters = JSON.parse(JSON.stringify(DEFAULT_RACK_PARAMETERS));
  private cables: PatchCable[] = DEFAULT_CABLES.map((c) => ({ ...c }));

  // Cabinet I Endpoint & DSP Nodes
  private playerOutGain: GainNode | null = null;
  private ampInGain: GainNode | null = null;
  private ampHpf: BiquadFilterNode | null = null;
  private ampShaper: WaveShaperNode | null = null;
  private ampOutGain: GainNode | null = null;

  private cmpInGain: GainNode | null = null;
  private cmpDynNode: DynamicsCompressorNode | null = null;
  private hyperNode: ScriptProcessorNode | null = null;
  private cmpOutGain: GainNode | null = null;

  private eqInGain: GainNode | null = null;
  private eqLow: BiquadFilterNode | null = null;
  private eqLowMid: BiquadFilterNode | null = null;
  private eqHighMid: BiquadFilterNode | null = null;
  private eqHigh: BiquadFilterNode | null = null;
  private eqOutGain: GainNode | null = null;

  private expInGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private masterFreqData: Uint8Array<ArrayBuffer> | null = null;

  // Cabinet II Endpoint & DSP Nodes
  private nullInGain: GainNode | null = null;
  private nullProcessor: ScriptProcessorNode | null = null;
  private nullOutGain: GainNode | null = null;

  private spcInGain: GainNode | null = null;
  private spcBypassGain: GainNode | null = null;
  private spcOutGain: GainNode | null = null;
  private spcBands: AcousticBandNodes[] = [];

  private revInGain: GainNode | null = null;
  private revTiltLow: BiquadFilterNode | null = null;
  private revTiltHigh: BiquadFilterNode | null = null;
  private revProcessor: ScriptProcessorNode | null = null;
  private revOutGain: GainNode | null = null;

  private nclInGain: GainNode | null = null;
  private nclProcessor: ScriptProcessorNode | null = null;
  private nclOutGain: GainNode | null = null;

  private zdbInGain: GainNode | null = null;
  private zdbShaper: WaveShaperNode | null = null;
  private zdbOutGain: GainNode | null = null;

  // Cabinet III Endpoint & DSP Nodes (Luxury Mastering Suite)
  private tapInGain: GainNode | null = null;
  private tapHeadBump: BiquadFilterNode | null = null;
  private tapDelay: DelayNode | null = null;
  private tapFlutterOsc: OscillatorNode | null = null;
  private tapFlutterGain: GainNode | null = null;
  private tapShaper: WaveShaperNode | null = null;
  private tapWarmthLp: BiquadFilterNode | null = null;
  private tapOutGain: GainNode | null = null;

  private luxInGain: GainNode | null = null;
  private luxDryGain: GainNode | null = null;
  private luxPreDelay: DelayNode | null = null;
  private luxConvolver: ConvolverNode | null = null;
  private luxShimmerShelf: BiquadFilterNode | null = null;
  private luxWetGain: GainNode | null = null;
  private luxOutGain: GainNode | null = null;
  private luxLastDecay = -1;
  private luxLastShimmer = -1;
  private luxLastSpread = true;

  private excInGain: GainNode | null = null;
  private excDryGain: GainNode | null = null;
  private excHpFilter: BiquadFilterNode | null = null;
  private excShaper: WaveShaperNode | null = null;
  private excHarmonicGain: GainNode | null = null;
  private excSubShelf: BiquadFilterNode | null = null;
  private excAirShelf: BiquadFilterNode | null = null;
  private excOutGain: GainNode | null = null;

  private imgInGain: GainNode | null = null;
  private imgSplitter: ChannelSplitterNode | null = null;
  private imgMerger: ChannelMergerNode | null = null;
  private imgSumL: GainNode | null = null;
  private imgSumR: GainNode | null = null;
  private imgDiffL: GainNode | null = null;
  private imgDiffR: GainNode | null = null;
  private imgMidGain: GainNode | null = null;
  private imgSideGain: GainNode | null = null;
  private imgMidToL: GainNode | null = null;
  private imgMidToR: GainNode | null = null;
  private imgSideToL: GainNode | null = null;
  private imgSideToR: GainNode | null = null;
  private imgOutGain: GainNode | null = null;
  private imgLeftAnalyser: AnalyserNode | null = null;
  private imgRightAnalyser: AnalyserNode | null = null;

  private finInGain: GainNode | null = null;
  private finGlowShaper: WaveShaperNode | null = null;
  private finTrimGain: GainNode | null = null;
  private finMonoSum: GainNode | null = null;
  private finLimiter: WaveShaperNode | null = null;
  private finOutGain: GainNode | null = null;

  // Per-module analysers for live signal flow & VU meters across all three cabinets
  private stageAnalysers: Partial<Record<OutputJackId | 'exp_in', AnalyserNode>> = {};
  private stageTimeBuf = new Uint8Array(128);
  private corrTimeBufL = new Uint8Array(128);
  private corrTimeBufR = new Uint8Array(128);

  // Audio sources
  private isDronePlaying = false;
  private droneOscs: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;

  private isMicActive = false;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  private loadedFile: File | null = null;
  private loadedAudioBuffer: AudioBuffer | null = null;
  private loadedFileName: string | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;
  private isFilePlaying = false;
  private filePlayOffset = 0;
  private filePlayStartedAt = 0;

  private fallbackAudioEl: HTMLAudioElement | null = null;
  private fallbackMediaSource: MediaElementAudioSourceNode | null = null;
  private fallbackObjectUrl: string | null = null;
  private fallbackDuration = 0;

  // Live Master Bus Recording Capture & Sovereign .webm MediaRecorder
  private isRecordingBus = false;
  private recordedLeft: Float32Array[] = [];
  private recordedRight: Float32Array[] = [];
  private busRecorderNode: ScriptProcessorNode | null = null;
  private recordedClip: { left: Float32Array; right: Float32Array; sampleRate: number } | null = null;

  private masterPowerGain: GainNode | null = null;
  private sovBusIn: GainNode | null = null;
  private sovBusOut: GainNode | null = null;
  private sovSubIn: GainNode | null = null;
  private sovSubFilter: BiquadFilterNode | null = null;
  private sovSubDrive: WaveShaperNode | null = null;
  private sovSubMix: GainNode | null = null;
  private sovSubOut: GainNode | null = null;

  private sovTransIn: GainNode | null = null;
  private sovTransPunch: BiquadFilterNode | null = null;
  private sovTransBody: BiquadFilterNode | null = null;
  private sovTransOut: GainNode | null = null;

  private sovVcaIn: GainNode | null = null;
  private sovVcaComp: DynamicsCompressorNode | null = null;
  private sovVcaOut: GainNode | null = null;

  private sovLimIn: GainNode | null = null;
  private sovLimComp: DynamicsCompressorNode | null = null;
  private sovLimCeiling: WaveShaperNode | null = null;
  private sovLimOut: GainNode | null = null;
  private lastSovOrderSig = '';

  private isTestTonePlaying = false;
  private testOsc: OscillatorNode | null = null;
  private testOscGain: GainNode | null = null;

  private webmDest: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private webmChunks: BlobPart[] = [];
  private isRecordingWebm = false;
  private webmStartedAt = 0;

  // Cabinet I & II Real-Time Telemetry State
  private dspState = {
    isSilentGap: true,
    gapCondensePct: 0,
    waveRoundVal: 0,
    sonicSegmentCount: 0,
    envTrace: new Array<number>(64).fill(0),
    envIdx: 0,
    silenceAmpDb: -72,
    trueZeroProximity: 0,
    negLiftDb: 0,
  };

  private beatState = {
    beatCount: 0,
    transientAvg: 0,
    lastBeatTime: -10,
    smoothedMeterEnergy: 0,
    isBeatTriggered: false,
  };

  private onBeatCallback?: () => void;
  private onSilenceGapCallback?: (isGap: boolean) => void;

  public setCallbacks(opts: {
    onBeat?: () => void;
    onSilenceGap?: (isGap: boolean) => void;
  }) {
    this.onBeatCallback = opts.onBeat;
    this.onSilenceGapCallback = opts.onSilenceGap;
  }

  public async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.buildNodes(this.ctx);
      this.applyParameters(this.params);
      this.rewirePatchbay(this.cables);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  public unlockOnGesture() {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  private createAnalyser(ctx: AudioContext, fftSize = 256): AnalyserNode {
    const an = ctx.createAnalyser();
    an.fftSize = fftSize;
    an.smoothingTimeConstant = 0.72;
    return an;
  }

  private buildNodes(ctx: AudioContext) {
    // === CABINET I ===
    // 1. Player Out
    this.playerOutGain = ctx.createGain();
    this.stageAnalysers.player_out = this.createAnalyser(ctx, 128);
    this.playerOutGain.connect(this.stageAnalysers.player_out);

    // 2. Class-A Analog Amplifier
    this.ampInGain = ctx.createGain();
    this.ampHpf = ctx.createBiquadFilter();
    this.ampHpf.type = 'highpass';
    this.ampHpf.frequency.value = 20;
    this.ampShaper = ctx.createWaveShaper();
    this.ampShaper.oversample = '2x';
    this.ampOutGain = ctx.createGain();
    this.stageAnalysers.amp_out = this.createAnalyser(ctx, 128);

    this.ampInGain.connect(this.ampHpf);
    this.ampHpf.connect(this.ampShaper);
    this.ampShaper.connect(this.ampOutGain);
    this.ampOutGain.connect(this.stageAnalysers.amp_out);

    // 3. Analog + Silence-Gap Hyper-Compressor
    this.cmpInGain = ctx.createGain();
    this.cmpDynNode = ctx.createDynamicsCompressor();
    this.hyperNode = this.createHyperCompressorNode(ctx);
    this.cmpOutGain = ctx.createGain();
    this.stageAnalysers.cmp_out = this.createAnalyser(ctx, 128);

    this.cmpInGain.connect(this.cmpDynNode);
    this.cmpDynNode.connect(this.hyperNode);
    this.hyperNode.connect(this.cmpOutGain);
    this.cmpOutGain.connect(this.stageAnalysers.cmp_out);

    // 4. 4-Band Analog Mastering EQ
    this.eqInGain = ctx.createGain();
    this.eqLow = ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 60;

    this.eqLowMid = ctx.createBiquadFilter();
    this.eqLowMid.type = 'peaking';
    this.eqLowMid.frequency.value = 350;
    this.eqLowMid.Q.value = 1.0;

    this.eqHighMid = ctx.createBiquadFilter();
    this.eqHighMid.type = 'peaking';
    this.eqHighMid.frequency.value = 2400;
    this.eqHighMid.Q.value = 1.2;

    this.eqHigh = ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 10000;

    this.eqOutGain = ctx.createGain();
    this.stageAnalysers.eq_out = this.createAnalyser(ctx, 128);

    this.eqInGain.connect(this.eqLow);
    this.eqLow.connect(this.eqLowMid);
    this.eqLowMid.connect(this.eqHighMid);
    this.eqHighMid.connect(this.eqHigh);
    this.eqHigh.connect(this.eqOutGain);
    this.eqOutGain.connect(this.stageAnalysers.eq_out);

    // === CABINET II ===
    // 6. INV-06 Phase & Silence Null Canceller
    this.nullInGain = ctx.createGain();
    this.nullProcessor = this.createPhaseNullNode(ctx);
    this.nullOutGain = ctx.createGain();
    this.stageAnalysers.null_out = this.createAnalyser(ctx, 128);
    this.nullInGain.connect(this.nullProcessor);
    this.nullProcessor.connect(this.nullOutGain);
    this.nullOutGain.connect(this.stageAnalysers.null_out);

    // 7. SPC-07 4-Band Acoustic Space Separator
    this.spcInGain = ctx.createGain();
    this.spcBypassGain = ctx.createGain();
    this.spcBypassGain.gain.value = 0;
    this.spcOutGain = ctx.createGain();
    this.stageAnalysers.spc_out = this.createAnalyser(ctx, 128);

    this.spcInGain.connect(this.spcBypassGain);
    this.spcBypassGain.connect(this.spcOutGain);

    const bandDefs: Array<{ type: BiquadFilterType; freq: number; q: number }> = [
      { type: 'lowpass', freq: 180, q: 0.707 },
      { type: 'bandpass', freq: 420, q: 0.9 },
      { type: 'bandpass', freq: 2100, q: 0.9 },
      { type: 'highpass', freq: 4200, q: 0.707 },
    ];
    this.spcBands = bandDefs.map((bd) => {
      const filter = ctx.createBiquadFilter();
      filter.type = bd.type;
      filter.frequency.value = bd.freq;
      filter.Q.value = bd.q;

      const delay = ctx.createDelay(0.06);
      delay.delayTime.value = 0;

      const panner = ctx.createStereoPanner();
      panner.pan.value = 0;

      const gain = ctx.createGain();
      gain.gain.value = 1;

      const analyser = this.createAnalyser(ctx, 128);

      this.spcInGain!.connect(filter);
      filter.connect(delay);
      delay.connect(panner);
      panner.connect(gain);
      gain.connect(analyser);
      gain.connect(this.spcOutGain!);

      return { filter, delay, panner, gain, analyser };
    });
    this.spcOutGain.connect(this.stageAnalysers.spc_out);

    // 8. REV-08 Reversed-Frequency Silence Amplifier
    this.revInGain = ctx.createGain();
    this.revTiltLow = ctx.createBiquadFilter();
    this.revTiltLow.type = 'lowshelf';
    this.revTiltLow.frequency.value = 1400;
    this.revTiltHigh = ctx.createBiquadFilter();
    this.revTiltHigh.type = 'highshelf';
    this.revTiltHigh.frequency.value = 1400;
    this.revProcessor = this.createReversedFrequencyNode(ctx);
    this.revOutGain = ctx.createGain();
    this.stageAnalysers.rev_out = this.createAnalyser(ctx, 128);

    this.revInGain.connect(this.revTiltLow);
    this.revTiltLow.connect(this.revTiltHigh);
    this.revTiltHigh.connect(this.revProcessor);
    this.revProcessor.connect(this.revOutGain);
    this.revOutGain.connect(this.stageAnalysers.rev_out);

    // 9. NCL-09 Negative Compressor / Limiter / Gate Master
    this.nclInGain = ctx.createGain();
    this.nclProcessor = this.createNegativeMasterNode(ctx);
    this.nclOutGain = ctx.createGain();
    this.stageAnalysers.ncl_out = this.createAnalyser(ctx, 128);

    this.nclInGain.connect(this.nclProcessor);
    this.nclProcessor.connect(this.nclOutGain);
    this.nclOutGain.connect(this.stageAnalysers.ncl_out);

    // 10. ZDB-10 True-0dB Summation Bus
    this.zdbInGain = ctx.createGain();
    this.zdbShaper = ctx.createWaveShaper();
    this.zdbShaper.oversample = '2x';
    this.zdbShaper.curve = createZeroDbLimiterCurve(1.0);
    this.zdbOutGain = ctx.createGain();
    this.stageAnalysers.zdb_out = this.createAnalyser(ctx, 128);

    this.zdbInGain.connect(this.zdbShaper);
    this.zdbShaper.connect(this.zdbOutGain);
    this.zdbOutGain.connect(this.stageAnalysers.zdb_out);

    // === CABINET III: LUXURY MASTERING SUITE ===
    // 11. TAP-11 Analog Tape & Wow/Flutter
    this.tapInGain = ctx.createGain();
    this.tapHeadBump = ctx.createBiquadFilter();
    this.tapHeadBump.type = 'lowshelf';
    this.tapHeadBump.frequency.value = 85;
    this.tapDelay = ctx.createDelay(0.05);
    this.tapDelay.delayTime.value = 0.004;
    this.tapFlutterOsc = ctx.createOscillator();
    this.tapFlutterOsc.type = 'sine';
    this.tapFlutterOsc.frequency.value = 1.45;
    this.tapFlutterGain = ctx.createGain();
    this.tapFlutterGain.gain.value = 0.00018;
    this.tapFlutterOsc.connect(this.tapFlutterGain);
    this.tapFlutterGain.connect(this.tapDelay.delayTime);
    this.tapFlutterOsc.start();
    this.tapShaper = ctx.createWaveShaper();
    this.tapShaper.oversample = '2x';
    this.tapShaper.curve = createTapeSaturationCurve(0.32, 0.45);
    this.tapWarmthLp = ctx.createBiquadFilter();
    this.tapWarmthLp.type = 'highshelf';
    this.tapWarmthLp.frequency.value = 11500;
    this.tapOutGain = ctx.createGain();
    this.stageAnalysers.tap_out = this.createAnalyser(ctx, 128);

    this.tapInGain.connect(this.tapHeadBump);
    this.tapHeadBump.connect(this.tapDelay);
    this.tapDelay.connect(this.tapShaper);
    this.tapShaper.connect(this.tapWarmthLp);
    this.tapWarmthLp.connect(this.tapOutGain);
    this.tapOutGain.connect(this.stageAnalysers.tap_out);

    // 12. LUX-12 Ambient Luxury Hall Reverb
    this.luxInGain = ctx.createGain();
    this.luxDryGain = ctx.createGain();
    this.luxDryGain.gain.value = 0.88;
    this.luxPreDelay = ctx.createDelay(0.15);
    this.luxPreDelay.delayTime.value = 0.024;
    this.luxConvolver = ctx.createConvolver();
    this.luxConvolver.buffer = createLuxuryHallIR(ctx, 2.4, 0.35, true);
    this.luxLastDecay = 2.4;
    this.luxLastShimmer = 0.35;
    this.luxLastSpread = true;
    this.luxShimmerShelf = ctx.createBiquadFilter();
    this.luxShimmerShelf.type = 'highshelf';
    this.luxShimmerShelf.frequency.value = 4600;
    this.luxWetGain = ctx.createGain();
    this.luxWetGain.gain.value = 0.22;
    this.luxOutGain = ctx.createGain();
    this.stageAnalysers.lux_out = this.createAnalyser(ctx, 128);

    this.luxInGain.connect(this.luxDryGain);
    this.luxDryGain.connect(this.luxOutGain);
    this.luxInGain.connect(this.luxPreDelay);
    this.luxPreDelay.connect(this.luxConvolver);
    this.luxConvolver.connect(this.luxShimmerShelf);
    this.luxShimmerShelf.connect(this.luxWetGain);
    this.luxWetGain.connect(this.luxOutGain);
    this.luxOutGain.connect(this.stageAnalysers.lux_out);

    // 13. EXC-13 Harmonic Exciter & Air
    this.excInGain = ctx.createGain();
    this.excDryGain = ctx.createGain();
    this.excDryGain.gain.value = 1.0;
    this.excHpFilter = ctx.createBiquadFilter();
    this.excHpFilter.type = 'highpass';
    this.excHpFilter.frequency.value = 3400;
    this.excShaper = ctx.createWaveShaper();
    this.excShaper.curve = createExciterCurve(0.36, true);
    this.excHarmonicGain = ctx.createGain();
    this.excHarmonicGain.gain.value = 0.18;
    this.excSubShelf = ctx.createBiquadFilter();
    this.excSubShelf.type = 'lowshelf';
    this.excSubShelf.frequency.value = 80;
    this.excAirShelf = ctx.createBiquadFilter();
    this.excAirShelf.type = 'highshelf';
    this.excAirShelf.frequency.value = 11000;
    this.excOutGain = ctx.createGain();
    this.stageAnalysers.exc_out = this.createAnalyser(ctx, 128);

    this.excInGain.connect(this.excDryGain);
    this.excDryGain.connect(this.excSubShelf);
    this.excInGain.connect(this.excHpFilter);
    this.excHpFilter.connect(this.excShaper);
    this.excShaper.connect(this.excHarmonicGain);
    this.excHarmonicGain.connect(this.excSubShelf);
    this.excSubShelf.connect(this.excAirShelf);
    this.excAirShelf.connect(this.excOutGain);
    this.excOutGain.connect(this.stageAnalysers.exc_out);

    // 14. IMG-14 Mid/Side Stereo Field & Goniometer
    this.imgInGain = ctx.createGain();
    this.imgSplitter = ctx.createChannelSplitter(2);
    this.imgMerger = ctx.createChannelMerger(2);
    this.imgSumL = ctx.createGain();
    this.imgSumL.gain.value = 0.5;
    this.imgSumR = ctx.createGain();
    this.imgSumR.gain.value = 0.5;
    this.imgDiffL = ctx.createGain();
    this.imgDiffL.gain.value = 0.5;
    this.imgDiffR = ctx.createGain();
    this.imgDiffR.gain.value = -0.5;
    this.imgMidGain = ctx.createGain();
    this.imgMidGain.gain.value = 1.0;
    this.imgSideGain = ctx.createGain();
    this.imgSideGain.gain.value = 1.18;
    this.imgMidToL = ctx.createGain();
    this.imgMidToR = ctx.createGain();
    this.imgSideToL = ctx.createGain();
    this.imgSideToR = ctx.createGain();
    this.imgSideToR.gain.value = -1.0;
    this.imgOutGain = ctx.createGain();
    this.stageAnalysers.img_out = this.createAnalyser(ctx, 128);
    this.imgLeftAnalyser = this.createAnalyser(ctx, 128);
    this.imgRightAnalyser = this.createAnalyser(ctx, 128);

    this.imgInGain.connect(this.imgSplitter);
    this.imgSplitter.connect(this.imgSumL, 0);
    this.imgSplitter.connect(this.imgSumR, 1);
    this.imgSplitter.connect(this.imgDiffL, 0);
    this.imgSplitter.connect(this.imgDiffR, 1);

    this.imgSumL.connect(this.imgMidGain);
    this.imgSumR.connect(this.imgMidGain);
    this.imgDiffL.connect(this.imgSideGain);
    this.imgDiffR.connect(this.imgSideGain);

    this.imgMidGain.connect(this.imgMidToL);
    this.imgMidGain.connect(this.imgMidToR);
    this.imgSideGain.connect(this.imgSideToL);
    this.imgSideGain.connect(this.imgSideToR);

    this.imgMidToL.connect(this.imgMerger, 0, 0);
    this.imgSideToL.connect(this.imgMerger, 0, 0);
    this.imgMidToR.connect(this.imgMerger, 0, 1);
    this.imgSideToR.connect(this.imgMerger, 0, 1);

    this.imgMerger.connect(this.imgOutGain);
    this.imgOutGain.connect(this.stageAnalysers.img_out);
    const outSplit = ctx.createChannelSplitter(2);
    this.imgOutGain.connect(outSplit);
    outSplit.connect(this.imgLeftAnalyser, 0);
    outSplit.connect(this.imgRightAnalyser, 1);

    // 15. FIN-15 Champagne Reference Output Stage
    this.finInGain = ctx.createGain();
    this.finGlowShaper = ctx.createWaveShaper();
    this.finGlowShaper.curve = createTapeSaturationCurve(0.22, 0.35);
    this.finTrimGain = ctx.createGain();
    this.finMonoSum = ctx.createGain();
    this.finMonoSum.channelCountMode = 'max';
    this.finMonoSum.channelCount = 2;
    this.finLimiter = ctx.createWaveShaper();
    this.finLimiter.oversample = '2x';
    this.finLimiter.curve = createZeroDbLimiterCurve(0.98);
    this.finOutGain = ctx.createGain();
    this.stageAnalysers.fin_out = this.createAnalyser(ctx, 128);

    this.finInGain.connect(this.finGlowShaper);
    this.finGlowShaper.connect(this.finTrimGain);
    this.finTrimGain.connect(this.finMonoSum);
    this.finMonoSum.connect(this.finLimiter);
    this.finLimiter.connect(this.finOutGain);
    this.finOutGain.connect(this.stageAnalysers.fin_out);

    // 5. 128k Exporter, Sovereign DnD Bus & Master Output
    this.expInGain = ctx.createGain();
    this.sovBusIn = ctx.createGain();
    this.sovBusOut = ctx.createGain();

    // Sovereign Unit A: Sub-Bass Generator 808 (2U)
    this.sovSubIn = ctx.createGain();
    this.sovSubFilter = ctx.createBiquadFilter();
    this.sovSubFilter.type = 'lowpass';
    this.sovSubFilter.frequency.value = 55;
    this.sovSubFilter.Q.value = 1.6;
    this.sovSubDrive = ctx.createWaveShaper();
    this.sovSubDrive.curve = createTubeCurve(0.4, 0.05);
    this.sovSubMix = ctx.createGain();
    this.sovSubMix.gain.value = 0.28;
    this.sovSubOut = ctx.createGain();
    this.sovSubIn.connect(this.sovSubOut);
    this.sovSubIn.connect(this.sovSubFilter);
    this.sovSubFilter.connect(this.sovSubDrive);
    this.sovSubDrive.connect(this.sovSubMix);
    this.sovSubMix.connect(this.sovSubOut);

    // Sovereign Unit B: Master Transient Shaper (2U)
    this.sovTransIn = ctx.createGain();
    this.sovTransPunch = ctx.createBiquadFilter();
    this.sovTransPunch.type = 'peaking';
    this.sovTransPunch.frequency.value = 2600;
    this.sovTransPunch.Q.value = 0.9;
    this.sovTransBody = ctx.createBiquadFilter();
    this.sovTransBody.type = 'lowshelf';
    this.sovTransBody.frequency.value = 160;
    this.sovTransOut = ctx.createGain();
    this.sovTransIn.connect(this.sovTransPunch);
    this.sovTransPunch.connect(this.sovTransBody);
    this.sovTransBody.connect(this.sovTransOut);

    // Sovereign Unit C: SSL Style VCA Bus Glue Compressor (3U)
    this.sovVcaIn = ctx.createGain();
    this.sovVcaComp = ctx.createDynamicsCompressor();
    this.sovVcaComp.threshold.value = -18;
    this.sovVcaComp.ratio.value = 4;
    this.sovVcaComp.attack.value = 0.01;
    this.sovVcaComp.release.value = 0.1;
    this.sovVcaComp.knee.value = 6;
    this.sovVcaOut = ctx.createGain();
    this.sovVcaIn.connect(this.sovVcaComp);
    this.sovVcaComp.connect(this.sovVcaOut);

    // Sovereign Unit D: Master Brickwall Limiter & Maximizer (3U)
    this.sovLimIn = ctx.createGain();
    this.sovLimComp = ctx.createDynamicsCompressor();
    this.sovLimComp.threshold.value = -0.5;
    this.sovLimComp.ratio.value = 20;
    this.sovLimComp.attack.value = 0.001;
    this.sovLimComp.release.value = 0.05;
    this.sovLimCeiling = ctx.createWaveShaper();
    this.sovLimCeiling.oversample = '2x';
    this.sovLimCeiling.curve = createZeroDbLimiterCurve(0.98);
    this.sovLimOut = ctx.createGain();
    this.sovLimIn.connect(this.sovLimComp);
    this.sovLimComp.connect(this.sovLimCeiling);
    this.sovLimCeiling.connect(this.sovLimOut);

    this.masterPowerGain = ctx.createGain();
    this.masterPowerGain.gain.value = 1.0;
    this.masterGain = ctx.createGain();
    this.masterAnalyser = this.createAnalyser(ctx, 256);
    this.masterFreqData = new Uint8Array(new ArrayBuffer(this.masterAnalyser.frequencyBinCount));
    this.stageAnalysers.exp_in = this.createAnalyser(ctx, 128);

    this.expInGain.connect(this.stageAnalysers.exp_in);
    this.expInGain.connect(this.sovBusIn);
    this.rebuildSovereignChain(this.params.sovereignChain.order);
    this.sovBusOut.connect(this.masterPowerGain);
    this.masterPowerGain.connect(this.masterGain);
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(ctx.destination);

    if (typeof ctx.createMediaStreamDestination === 'function') {
      this.webmDest = ctx.createMediaStreamDestination();
      this.masterGain.connect(this.webmDest);
    }

    // Tap master bus for optional live performance capture
    this.busRecorderNode = ctx.createScriptProcessor(2048, 2, 2);
    this.busRecorderNode.onaudioprocess = (ev) => {
      const outL = ev.outputBuffer.getChannelData(0);
      const outR = ev.outputBuffer.getChannelData(1);
      outL.fill(0);
      outR.fill(0);
      if (!this.isRecordingBus) return;
      const inCh0 = ev.inputBuffer.getChannelData(0);
      const inCh1 =
        ev.inputBuffer.numberOfChannels > 1 ? ev.inputBuffer.getChannelData(1) : inCh0;
      this.recordedLeft.push(new Float32Array(inCh0));
      this.recordedRight.push(new Float32Array(inCh1));
    };
    this.masterGain.connect(this.busRecorderNode);
    this.busRecorderNode.connect(ctx.destination);
  }

  private rebuildSovereignChain(order: SovereignUnitId[]) {
    if (!this.sovBusIn || !this.sovBusOut) return;
    const activeNodes: Array<{ inNode: AudioNode; outNode: AudioNode }> = [];
    for (const unit of order) {
      if (unit === 'subGen' && this.sovSubIn && this.sovSubOut) {
        activeNodes.push({ inNode: this.sovSubIn, outNode: this.sovSubOut });
      } else if (unit === 'transient' && this.sovTransIn && this.sovTransOut) {
        activeNodes.push({ inNode: this.sovTransIn, outNode: this.sovTransOut });
      } else if (unit === 'vcaComp' && this.sovVcaIn && this.sovVcaOut) {
        activeNodes.push({ inNode: this.sovVcaIn, outNode: this.sovVcaOut });
      } else if (unit === 'limiter' && this.sovLimIn && this.sovLimOut) {
        activeNodes.push({ inNode: this.sovLimIn, outNode: this.sovLimOut });
      }
    }
    try {
      this.sovBusIn.disconnect();
      this.sovSubOut?.disconnect();
      this.sovTransOut?.disconnect();
      this.sovVcaOut?.disconnect();
      this.sovLimOut?.disconnect();
    } catch {
      // ignore initial disconnect
    }
    let cursor: AudioNode = this.sovBusIn;
    for (const seg of activeNodes) {
      cursor.connect(seg.inNode);
      cursor = seg.outNode;
    }
    cursor.connect(this.sovBusOut);
    this.lastSovOrderSig = order.join(',');
  }

  /**
   * Cabinet I: Stereo Silence-Segment Condenser + Wave-Rounding ScriptProcessor DSP.
   */
  private createHyperCompressorNode(ctx: AudioContext): ScriptProcessorNode {
    const bufferSize = 1024;
    const proc = ctx.createScriptProcessor(bufferSize, 2, 2);

    const ringCap = ctx.sampleRate * 2;
    const ringBufL = new Float32Array(ringCap);
    const ringBufR = new Float32Array(ringCap);
    const lookaheadCushion = 512;
    let writeIdx = 0;
    let readIdx = 0;
    let bufferedSamples = 0;

    let rmsEnv = 0;
    let wasActive = false;
    let silenceRunSamples = 0;
    let wavePhase = 0;
    let spliceSmoothEnv = 1.0;
    let prevOutL = 0;
    let prevOutR = 0;
    let lastGapNotify = true;

    proc.onaudioprocess = (event) => {
      const inL = event.inputBuffer.getChannelData(0);
      const inR = event.inputBuffer.numberOfChannels > 1 ? event.inputBuffer.getChannelData(1) : inL;
      const outL = event.outputBuffer.getChannelData(0);
      const outR = event.outputBuffer.getChannelData(1);
      const sr = ctx.sampleRate;
      const cmp = this.params.compressor;

      if (!cmp.power || !cmp.hyperEnabled) {
        outL.set(inL);
        outR.set(inR);
        this.dspState.isSilentGap = false;
        this.dspState.gapCondensePct = 0;
        return;
      }

      const avgFloor = (cmp.s1Floor + cmp.s2Floor + cmp.s3Floor) / 3;
      const avgCondense = (cmp.s1Condense + cmp.s2Condense + cmp.s3Condense) / 3;
      const avgRound = (cmp.s1Round + cmp.s2Round + cmp.s3Round + cmp.s4SpliceRound) / 4;
      const phaseInc = (Math.PI * 2 * cmp.s4WaveHz) / sr;

      let lastSampleActive = false;
      let activeSamplesInBlock = 0;

      for (let i = 0; i < inL.length; i++) {
        const sL = inL[i];
        const sR = inR[i];
        const absS = Math.max(Math.abs(sL), Math.abs(sR));

        const envAlpha = absS > rmsEnv ? 0.015 : 0.0018;
        rmsEnv = rmsEnv * (1 - envAlpha) + absS * envAlpha;

        const threshold = wasActive ? avgFloor * 0.85 : avgFloor;
        const isActiveSegment = rmsEnv >= threshold;
        lastSampleActive = isActiveSegment;

        if (isActiveSegment) {
          activeSamplesInBlock += 1;
          if (!wasActive) {
            this.dspState.sonicSegmentCount += 1;
          }
          silenceRunSamples = 0;
        } else {
          silenceRunSamples += 1;
        }
        wasActive = isActiveSegment;

        ringBufL[writeIdx] = sL;
        ringBufR[writeIdx] = sR;
        writeIdx = (writeIdx + 1) % ringCap;
        bufferedSamples = Math.min(ringCap, bufferedSamples + 1);

        let stepInt = 1;
        if (!isActiveSegment && bufferedSamples > lookaheadCushion) {
          const silenceSec = silenceRunSamples / sr;
          if (silenceSec > 0.05) {
            const ramp = Math.min(1.0, (silenceSec - 0.05) / 0.08);
            const extraSkip = avgCondense * (1.0 + cmp.s4Density * 1.8) * ramp;
            const maxAvail = Math.max(1, bufferedSamples - lookaheadCushion);
            stepInt = Math.min(maxAvail, Math.max(1, Math.round(1 + extraSkip)));
          }
        }

        let rawL = sL;
        let rawR = sR;
        if (bufferedSamples > 0) {
          const idx0 = Math.floor(readIdx) % ringCap;
          rawL = ringBufL[idx0];
          rawR = ringBufR[idx0];
          const actualStep = Math.min(bufferedSamples, stepInt);
          readIdx = (readIdx + actualStep) % ringCap;
          bufferedSamples -= actualStep;
        }

        wavePhase += phaseInc;
        if (wavePhase > Math.PI * 2) wavePhase -= Math.PI * 2;

        const targetGain = isActiveSegment ? 1.0 : 1.0 - avgCondense * 0.45;
        const smoothAlpha = 0.003 + (1.0 - avgRound) * 0.025;
        spliceSmoothEnv = spliceSmoothEnv * (1 - smoothAlpha) + targetGain * smoothAlpha;

        const waveMod = Math.sin(wavePhase) * 0.04 * cmp.s4Density * avgRound;
        const roundedEnvelope = Math.max(0.15, spliceSmoothEnv + waveMod);

        const dynComp =
          1.0 / (1.0 + cmp.s4Density * 0.22 * Math.max(0, absS - 0.72));
        let procL = rawL * roundedEnvelope * dynComp;
        let procR = rawR * roundedEnvelope * dynComp;

        if (stepInt > 1) {
          procL = prevOutL * 0.35 + procL * 0.65;
          procR = prevOutR * 0.35 + procR * 0.65;
        }
        prevOutL = procL;
        prevOutR = procR;

        outL[i] = Math.max(-1.0, Math.min(1.0, procL));
        outR[i] = Math.max(-1.0, Math.min(1.0, procR));
      }

      const silentNow = activeSamplesInBlock === 0 && !lastSampleActive;
      this.dspState.isSilentGap = silentNow;
      if (silentNow !== lastGapNotify) {
        lastGapNotify = silentNow;
        this.onSilenceGapCallback?.(silentNow);
      }

      this.dspState.gapCondensePct = Math.round(
        Math.min(
          100,
          silenceRunSamples > 0
            ? avgCondense * (1.0 + cmp.s4Density * 0.6) * 65
            : avgCondense * 35
        )
      );
      this.dspState.waveRoundVal = Math.sin(wavePhase) * avgRound;
      this.dspState.envTrace[this.dspState.envIdx] = Math.min(1.0, rmsEnv * 3.5);
      this.dspState.envIdx = (this.dspState.envIdx + 1) % this.dspState.envTrace.length;
    };

    return proc;
  }

  /**
   * Cabinet II (INV-06): Negative Cancellation & Digital Silence Isolation Node.
   * Musical phase-focus & transient cancellation without dulling or muting playback.
   */
  private createPhaseNullNode(ctx: AudioContext): ScriptProcessorNode {
    const proc = ctx.createScriptProcessor(1024, 2, 2);
    let env = 0;
    let prevL = 0;
    let prevR = 0;

    proc.onaudioprocess = (event) => {
      const inL = event.inputBuffer.getChannelData(0);
      const inR = event.inputBuffer.numberOfChannels > 1 ? event.inputBuffer.getChannelData(1) : inL;
      const outL = event.outputBuffer.getChannelData(0);
      const outR = event.outputBuffer.getChannelData(1);
      const pn = this.params.phaseNull;

      if (!pn.power) {
        outL.set(inL);
        outR.set(inR);
        return;
      }

      const pol = pn.polarityInvert ? -1 : 1;
      const floor = Math.max(0.002, pn.nullFloor);

      for (let i = 0; i < inL.length; i++) {
        const l = inL[i];
        const r = inR[i];
        const abs = Math.max(Math.abs(l), Math.abs(r));
        env = env * 0.96 + abs * 0.04;

        // Silence mask rises toward 1.0 as signal enters digital silence below nullFloor
        const silenceMask = Math.max(0, Math.min(1, 1 - env / floor));
        // Blend dry + phase-cancelled residual cleanly (preserving core fundamentals at low/mid cancelDepth)
        const activeAtten = 1 - pn.cancelDepth * (1 - silenceMask) * 0.42;
        const diffL = l - prevL * pn.cancelDepth * 0.45;
        const diffR = r - prevR * pn.cancelDepth * 0.45;
        prevL = l;
        prevR = r;

        const blendL = l * (1 - pn.cancelDepth * 0.45) + diffL * (pn.cancelDepth * 0.45);
        const blendR = r * (1 - pn.cancelDepth * 0.45) + diffR * (pn.cancelDepth * 0.45);
        const focusBoost = 1 + silenceMask * pn.zeroDbFocus * 0.95;

        outL[i] = Math.max(-1, Math.min(1, blendL * pol * activeAtten * focusBoost));
        outR[i] = Math.max(-1, Math.min(1, blendR * pol * activeAtten * focusBoost));
      }
    };

    return proc;
  }

  /**
   * Cabinet II (REV-08): Reversed-Frequency Silence Amplifier.
   * Uses clean harmonic conjugate weighting + Biquad spectral tilt around mirrorPivotHz
   * to amplify silent pockets cleanly toward 0 dBFS with zero aliasing buzz.
   */
  private createReversedFrequencyNode(ctx: AudioContext): ScriptProcessorNode {
    const proc = ctx.createScriptProcessor(1024, 2, 2);
    let env = 0;
    let lpL = 0;
    let lpR = 0;

    proc.onaudioprocess = (event) => {
      const inL = event.inputBuffer.getChannelData(0);
      const inR = event.inputBuffer.numberOfChannels > 1 ? event.inputBuffer.getChannelData(1) : inL;
      const outL = event.outputBuffer.getChannelData(0);
      const outR = event.outputBuffer.getChannelData(1);
      const rev = this.params.revAmp;
      const pn = this.params.phaseNull;

      if (!rev.power) {
        outL.set(inL);
        outR.set(inR);
        this.dspState.negLiftDb = 0;
        return;
      }

      const maxLiftDb = rev.negAmpGainDb;
      const silenceRef = Math.max(0.015, pn.nullFloor * 2.0);
      // Clean 1-pole tilt cutoff derived from mirrorPivotHz (no sample-sign Nyquist ring-mod)
      const fc = Math.max(200, Math.min(6000, rev.mirrorPivotHz));
      const lpAlpha = 1 - Math.exp((-2 * Math.PI * fc) / ctx.sampleRate);
      let blockLiftSum = 0;

      for (let i = 0; i < inL.length; i++) {
        const l = inL[i];
        const r = inR[i];
        const abs = Math.max(Math.abs(l), Math.abs(r));
        const alpha = abs > env ? 0.02 : 0.0025;
        env = env * (1 - alpha) + abs * alpha;

        // Clean conjugate phase-flipped air/body complement (artifact-free)
        lpL += lpAlpha * (l - lpL);
        lpR += lpAlpha * (r - lpR);
        const hiL = l - lpL;
        const hiR = r - lpR;
        const tiltL = lpL * (1 - rev.reverseFreq * 0.25) - hiL * (rev.reverseFreq * 0.35);
        const tiltR = lpR * (1 - rev.reverseFreq * 0.25) - hiR * (rev.reverseFreq * 0.35);

        const revL = l * (1 - rev.reverseFreq * 0.45) + tiltL * (rev.reverseFreq * 0.45);
        const revR = r * (1 - rev.reverseFreq * 0.45) + tiltR * (rev.reverseFreq * 0.45);

        // Negative amplification: quiet gaps lift smoothly upward, full music passes unclipped
        const silenceFactor = Math.max(0, Math.min(1, 1 - env / silenceRef));
        const activeLiftDb = maxLiftDb * silenceFactor;
        blockLiftSum += activeLiftDb;
        const liftLin = Math.pow(10, activeLiftDb / 20);

        let oL = revL * liftLin;
        let oR = revR * liftLin;

        if (rev.trueZeroClamp) {
          oL = Math.tanh(oL);
          oR = Math.tanh(oR);
        }

        outL[i] = Math.max(-1, Math.min(1, oL));
        outR[i] = Math.max(-1, Math.min(1, oR));
      }

      this.dspState.negLiftDb = Number((blockLiftSum / inL.length).toFixed(1));
    };

    return proc;
  }

  /**
   * Cabinet II (NCL-09): Negative Compressor / Limiter / Gate Master.
   * Gently lifts quiet ambient pockets toward True-0dB while mastering peaks cleanly.
   */
  private createNegativeMasterNode(ctx: AudioContext): ScriptProcessorNode {
    const proc = ctx.createScriptProcessor(1024, 2, 2);
    let env = 0.002;
    let smoothGain = 1.0;

    proc.onaudioprocess = (event) => {
      const inL = event.inputBuffer.getChannelData(0);
      const inR = event.inputBuffer.numberOfChannels > 1 ? event.inputBuffer.getChannelData(1) : inL;
      const outL = event.outputBuffer.getChannelData(0);
      const outR = event.outputBuffer.getChannelData(1);
      const nm = this.params.negMaster;

      if (!nm.power) {
        outL.set(inL);
        outR.set(inR);
        this.dspState.silenceAmpDb = -72;
        this.dspState.trueZeroProximity = 0;
        return;
      }

      const ceilLin = Math.pow(10, Math.min(0, nm.limiterCeilingDb) / 20);
      const invFactor = 1 - 1 / Math.max(1.0, nm.invRatio);
      let outPeak = 0;

      for (let i = 0; i < inL.length; i++) {
        const l = inL[i];
        const r = inR[i];
        const abs = Math.max(Math.abs(l), Math.abs(r));
        const alpha = abs > env ? 0.035 : 0.0035;
        env = Math.max(1e-5, env * (1 - alpha) + abs * alpha);
        const inDb = 20 * Math.log10(env);

        let targetGain = 1.0;
        if (nm.gateInvert) {
          // Only lift audible low-level passages between gateFloorDb and negThreshold
          if (inDb < nm.negThreshold && inDb > nm.gateFloorDb - 10) {
            const deficitDb = nm.negThreshold - inDb;
            const boostDb = Math.min(14, deficitDb * invFactor * nm.silenceLift * 0.55);
            targetGain = Math.pow(10, boostDb / 20);
          } else if (inDb >= nm.negThreshold) {
            // Subtle mastering glue above threshold (never squashing normal audio)
            const overDb = Math.max(0, inDb - (nm.negThreshold + 12));
            const duckDb = Math.min(4.5, overDb * invFactor * 0.25);
            targetGain = Math.pow(10, -duckDb / 20);
          }
        } else {
          if (inDb < nm.gateFloorDb) {
            targetGain = 0.08;
          } else if (inDb < nm.negThreshold) {
            const deficitDb = nm.negThreshold - inDb;
            const boostDb = Math.min(12, deficitDb * invFactor * nm.silenceLift * 0.45);
            targetGain = Math.pow(10, boostDb / 20);
          }
        }

        smoothGain = smoothGain * 0.96 + targetGain * 0.04;
        let sL = l * smoothGain;
        let sR = r * smoothGain;

        const peakSample = Math.max(Math.abs(sL), Math.abs(sR));
        if (peakSample > ceilLin) {
          const limScale = ceilLin / peakSample;
          sL *= limScale;
          sR *= limScale;
        }

        outPeak = Math.max(outPeak, Math.abs(sL), Math.abs(sR));
        outL[i] = Math.max(-ceilLin, Math.min(ceilLin, sL));
        outR[i] = Math.max(-ceilLin, Math.min(ceilLin, sR));
      }

      const dbOut = outPeak > 1e-4 ? 20 * Math.log10(outPeak) : -72;
      this.dspState.silenceAmpDb = Number(Math.max(-72, Math.min(0, dbOut)).toFixed(1));
      this.dspState.trueZeroProximity = Math.max(0, Math.min(1, (dbOut + 60) / 60));
    };

    return proc;
  }

  public applyParameters(next: RackParameters) {
    this.params = JSON.parse(JSON.stringify(next));
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // --- Cabinet I ---
    this.playerOutGain?.gain.setTargetAtTime(next.player.inputTrim, now, 0.02);
    if (this.bufferSource) this.bufferSource.loop = next.player.loop;
    if (this.fallbackAudioEl) this.fallbackAudioEl.loop = next.player.loop;

    if (this.ampHpf && this.ampShaper && this.ampOutGain) {
      if (next.amp.power) {
        this.ampHpf.frequency.setTargetAtTime(next.amp.hpfEnabled ? 75 : 18, now, 0.02);
        this.ampShaper.curve = createTubeCurve(next.amp.drive, next.amp.bias);
        this.ampOutGain.gain.setTargetAtTime(next.amp.outputGain, now, 0.02);
      } else {
        this.ampHpf.frequency.setTargetAtTime(10, now, 0.02);
        this.ampShaper.curve = createTubeCurve(0, 0);
        this.ampOutGain.gain.setTargetAtTime(1.0, now, 0.02);
      }
    }

    if (this.cmpDynNode && this.cmpOutGain) {
      if (next.compressor.power) {
        this.cmpDynNode.threshold.setTargetAtTime(next.compressor.threshold, now, 0.02);
        this.cmpDynNode.ratio.setTargetAtTime(next.compressor.ratio, now, 0.02);
        this.cmpDynNode.attack.setTargetAtTime(next.compressor.attack, now, 0.02);
        this.cmpDynNode.release.setTargetAtTime(next.compressor.release, now, 0.02);
        this.cmpOutGain.gain.setTargetAtTime(next.compressor.makeupGain, now, 0.02);
      } else {
        this.cmpDynNode.threshold.setTargetAtTime(0, now, 0.02);
        this.cmpDynNode.ratio.setTargetAtTime(1, now, 0.02);
        this.cmpOutGain.gain.setTargetAtTime(1.0, now, 0.02);
      }
    }

    if (this.eqLow && this.eqLowMid && this.eqHighMid && this.eqHigh) {
      const mul = next.eq.power ? 1 : 0;
      this.eqLow.gain.setTargetAtTime(next.eq.lowGain * mul, now, 0.02);
      this.eqLowMid.gain.setTargetAtTime(next.eq.lowMidGain * mul, now, 0.02);
      this.eqHighMid.gain.setTargetAtTime(next.eq.highMidGain * mul, now, 0.02);
      this.eqHighMid.Q.setTargetAtTime(next.eq.presenceQ, now, 0.02);
      this.eqHigh.gain.setTargetAtTime(next.eq.highGain * mul, now, 0.02);
    }

    // --- Cabinet II ---
    // SPC-07: 4-Band Acoustic Space Separator
    if (this.spcBypassGain && this.spcBands.length === 4) {
      const spc = next.acousticSpace;
      const bandConfigs: AcousticBandSpace[] = [spc.low, spc.lowMid, spc.highMid, spc.high];
      const anySolo = bandConfigs.some((b) => b.solo);

      this.spcBypassGain.gain.setTargetAtTime(spc.power ? 0 : 1, now, 0.02);
      for (let i = 0; i < 4; i++) {
        const cfg = bandConfigs[i];
        const nodes = this.spcBands[i];
        const active = spc.power && cfg.enabled && (!anySolo || cfg.solo);
        nodes.gain.gain.setTargetAtTime(active ? cfg.negGain : 0, now, 0.02);
        nodes.panner.pan.setTargetAtTime(
          Math.max(-1, Math.min(1, cfg.pan * spc.roomWidth)),
          now,
          0.02
        );
        // Haas / acoustic room depth offset per band (0..30ms)
        nodes.delay.delayTime.setTargetAtTime(
          Math.max(0, Math.min(0.04, cfg.spaceDepth * 0.024 * spc.roomWidth)),
          now,
          0.02
        );
      }
    }

    // REV-08: Reversed-Frequency Spectral Tilt
    if (this.revTiltLow && this.revTiltHigh) {
      const rev = next.revAmp;
      const tiltDb = rev.power ? rev.reverseFreq * 9.0 : 0;
      this.revTiltLow.frequency.setTargetAtTime(rev.mirrorPivotHz, now, 0.02);
      this.revTiltHigh.frequency.setTargetAtTime(rev.mirrorPivotHz, now, 0.02);
      // Invert low vs high slope to reverse spectral balance
      this.revTiltLow.gain.setTargetAtTime(-tiltDb, now, 0.02);
      this.revTiltHigh.gain.setTargetAtTime(tiltDb, now, 0.02);
    }

    // ZDB-10: True-0dB Summation Bus
    if (this.zdbShaper && this.zdbOutGain) {
      const zdb = next.zeroDbBus;
      const ceil = zdb.trueZeroLock ? 1.0 : 1.25;
      this.zdbShaper.curve = createZeroDbLimiterCurve(ceil);
      const cohSign = zdb.phaseCoherence < -0.5 ? -1 : 1;
      const gainVal = zdb.power ? zdb.busTrim * cohSign : 1.0;
      this.zdbOutGain.gain.setTargetAtTime(gainVal, now, 0.02);
    }

    // --- Cabinet III ---
    // TAP-11: Analog Tape & Flutter
    if (this.tapHeadBump && this.tapShaper && this.tapWarmthLp && this.tapFlutterGain && this.tapFlutterOsc) {
      const tap = next.tapeSat;
      if (tap.power) {
        this.tapHeadBump.frequency.setTargetAtTime(tap.ips30 ? 55 : 95, now, 0.03);
        this.tapHeadBump.gain.setTargetAtTime(tap.warmth * (tap.ips30 ? 2.2 : 4.2), now, 0.03);
        this.tapShaper.curve = createTapeSaturationCurve(tap.saturation, tap.warmth);
        this.tapWarmthLp.gain.setTargetAtTime(-tap.warmth * (tap.ips30 ? 1.4 : 3.2), now, 0.03);
        this.tapFlutterGain.gain.setTargetAtTime(tap.wowFlutter * 0.0012, now, 0.03);
        this.tapFlutterOsc.frequency.setTargetAtTime(1.1 + tap.wowFlutter * 2.4, now, 0.03);
      } else {
        this.tapHeadBump.gain.setTargetAtTime(0, now, 0.02);
        this.tapShaper.curve = createTapeSaturationCurve(0, 0);
        this.tapWarmthLp.gain.setTargetAtTime(0, now, 0.02);
        this.tapFlutterGain.gain.setTargetAtTime(0, now, 0.02);
      }
    }

    // LUX-12: Ambient Luxury Hall Reverb
    if (
      this.ctx &&
      this.luxDryGain &&
      this.luxWetGain &&
      this.luxPreDelay &&
      this.luxConvolver &&
      this.luxShimmerShelf
    ) {
      const lux = next.luxuryVerb;
      if (lux.power) {
        const wet = Math.max(0, Math.min(0.85, lux.mix));
        this.luxDryGain.gain.setTargetAtTime(1 - wet * 0.35, now, 0.03);
        this.luxWetGain.gain.setTargetAtTime(wet, now, 0.03);
        this.luxPreDelay.delayTime.setTargetAtTime(
          Math.max(0, Math.min(0.12, lux.preDelayMs * 0.001)),
          now,
          0.03
        );
        this.luxShimmerShelf.gain.setTargetAtTime((lux.shimmer - 0.3) * 6.0, now, 0.03);
        if (
          Math.abs(lux.decaySec - this.luxLastDecay) > 0.25 ||
          Math.abs(lux.shimmer - this.luxLastShimmer) > 0.15 ||
          lux.stereoSpread !== this.luxLastSpread
        ) {
          this.luxLastDecay = lux.decaySec;
          this.luxLastShimmer = lux.shimmer;
          this.luxLastSpread = lux.stereoSpread;
          this.luxConvolver.buffer = createLuxuryHallIR(
            this.ctx,
            lux.decaySec,
            lux.shimmer,
            lux.stereoSpread
          );
        }
      } else {
        this.luxDryGain.gain.setTargetAtTime(1.0, now, 0.02);
        this.luxWetGain.gain.setTargetAtTime(0.0, now, 0.02);
      }
    }

    // EXC-13: Harmonic Exciter & Air
    if (this.excHpFilter && this.excShaper && this.excHarmonicGain && this.excSubShelf && this.excAirShelf) {
      const exc = next.harmonicExciter;
      if (exc.power) {
        this.excHpFilter.frequency.setTargetAtTime(exc.tuneHz, now, 0.03);
        this.excShaper.curve = createExciterCurve(exc.harmonics, exc.tubeOddEven);
        this.excHarmonicGain.gain.setTargetAtTime(exc.harmonics * 0.32, now, 0.03);
        this.excSubShelf.gain.setTargetAtTime(exc.subPunch * 4.5, now, 0.03);
        this.excAirShelf.gain.setTargetAtTime(exc.airGainDb * 0.65, now, 0.03);
      } else {
        this.excHarmonicGain.gain.setTargetAtTime(0, now, 0.02);
        this.excSubShelf.gain.setTargetAtTime(0, now, 0.02);
        this.excAirShelf.gain.setTargetAtTime(0, now, 0.02);
      }
    }

    // IMG-14: Mid/Side Stereo Field
    if (this.imgMidGain && this.imgSideGain) {
      const img = next.stereoImager;
      if (img.power) {
        const midLin = Math.pow(10, img.midGainDb / 20);
        const sideLin = Math.pow(10, img.sideGainDb / 20) * img.width;
        this.imgMidGain.gain.setTargetAtTime(img.msSolo ? 0.0 : midLin, now, 0.02);
        this.imgSideGain.gain.setTargetAtTime(sideLin, now, 0.02);
      } else {
        this.imgMidGain.gain.setTargetAtTime(1.0, now, 0.02);
        this.imgSideGain.gain.setTargetAtTime(1.0, now, 0.02);
      }
    }

    // FIN-15: Champagne Reference Output Stage
    if (this.finGlowShaper && this.finTrimGain && this.finMonoSum && this.finLimiter) {
      const fin = next.luxuryMaster;
      if (fin.power) {
        this.finGlowShaper.curve = createTapeSaturationCurve(fin.analogGlow * 0.45, fin.analogGlow * 0.5);
        this.finTrimGain.gain.setTargetAtTime(fin.dimSwitch ? 0.251 : 1.0, now, 0.02);
        this.finMonoSum.channelCount = fin.monoCheck ? 1 : 2;
        this.finMonoSum.channelCountMode = fin.monoCheck ? 'explicit' : 'max';
        const ceilLin = Math.pow(10, Math.min(0, fin.ceilingDb) / 20);
        this.finLimiter.curve = createZeroDbLimiterCurve(ceilLin);
      } else {
        this.finGlowShaper.curve = createTapeSaturationCurve(0, 0);
        this.finTrimGain.gain.setTargetAtTime(1.0, now, 0.02);
        this.finMonoSum.channelCount = 2;
        this.finMonoSum.channelCountMode = 'max';
        this.finLimiter.curve = createZeroDbLimiterCurve(1.0);
      }
    }

    // Sovereign DnD Mastering Bus + Master Power Gate
    const sov = next.sovereignChain;
    if (this.ctx && sov.order.join(',') !== this.lastSovOrderSig) {
      this.rebuildSovereignChain(sov.order);
    }
    if (this.sovSubFilter && this.sovSubDrive && this.sovSubMix) {
      const active = !sov.bypass.subGen;
      this.sovSubFilter.frequency.setTargetAtTime(sov.subGen.freqHz, now, 0.02);
      this.sovSubDrive.curve = createTubeCurve(sov.subGen.drive * 0.85, 0.04);
      this.sovSubMix.gain.setTargetAtTime(active ? sov.subGen.drive * 0.55 : 0, now, 0.02);
    }
    if (this.sovTransPunch && this.sovTransBody) {
      const active = !sov.bypass.transient;
      this.sovTransPunch.gain.setTargetAtTime(active ? sov.transient.attackDb : 0, now, 0.02);
      this.sovTransBody.gain.setTargetAtTime(
        active ? ((sov.transient.sustainPct - 100) / 50) * 3.5 : 0,
        now,
        0.02
      );
    }
    if (this.sovVcaComp && this.sovVcaOut) {
      const active = !sov.bypass.vcaComp;
      this.sovVcaComp.threshold.setTargetAtTime(active ? sov.vcaComp.threshold : 0, now, 0.02);
      this.sovVcaComp.ratio.setTargetAtTime(active ? sov.vcaComp.ratio : 1, now, 0.02);
      this.sovVcaComp.release.setTargetAtTime(
        Math.max(0.02, sov.vcaComp.releaseMs * 0.001),
        now,
        0.02
      );
      this.sovVcaOut.gain.setTargetAtTime(active ? sov.vcaComp.makeupGain : 1.0, now, 0.02);
    }
    if (this.sovLimComp && this.sovLimCeiling) {
      const active = !sov.bypass.limiter;
      this.sovLimComp.threshold.setTargetAtTime(active ? sov.limiter.thresholdDb : 0, now, 0.02);
      this.sovLimComp.ratio.setTargetAtTime(active ? 20 : 1, now, 0.02);
      const limCeilLin = Math.pow(10, Math.min(0, sov.limiter.ceilingDb) / 20);
      this.sovLimCeiling.curve = createZeroDbLimiterCurve(active ? limCeilLin : 1.0);
    }

    // Sync Cabinet III FX bypasses if Sovereign DnD switches bypassed them
    if (sov.bypass.tapeSat && this.tapShaper) {
      this.tapShaper.curve = createTapeSaturationCurve(0, 0);
    }
    if (sov.bypass.exciter && this.excHarmonicGain) {
      this.excHarmonicGain.gain.setTargetAtTime(0, now, 0.02);
    }
    if (sov.bypass.reverb && this.luxWetGain) {
      this.luxWetGain.gain.setTargetAtTime(0, now, 0.02);
    }

    this.masterPowerGain?.gain.setTargetAtTime(next.masterPower ? 1.0 : 0.0, now, 0.025);
    this.masterGain?.gain.setTargetAtTime(next.exporter.masterVolume, now, 0.02);
  }

  private getOutputNode(jack: OutputJackId): AudioNode | null {
    switch (jack) {
      case 'player_out':
        return this.playerOutGain;
      case 'amp_out':
        return this.ampOutGain;
      case 'cmp_out':
        return this.cmpOutGain;
      case 'eq_out':
        return this.eqOutGain;
      case 'null_out':
        return this.nullOutGain;
      case 'spc_out':
        return this.spcOutGain;
      case 'rev_out':
        return this.revOutGain;
      case 'ncl_out':
        return this.nclOutGain;
      case 'zdb_out':
        return this.zdbOutGain;
      case 'tap_out':
        return this.tapOutGain;
      case 'lux_out':
        return this.luxOutGain;
      case 'exc_out':
        return this.excOutGain;
      case 'img_out':
        return this.imgOutGain;
      case 'fin_out':
        return this.finOutGain;
    }
  }

  private getInputNode(jack: InputJackId): AudioNode | null {
    switch (jack) {
      case 'amp_in':
        return this.ampInGain;
      case 'cmp_in':
        return this.cmpInGain;
      case 'eq_in':
        return this.eqInGain;
      case 'exp_in':
        return this.expInGain;
      case 'null_in':
        return this.nullInGain;
      case 'spc_in':
        return this.spcInGain;
      case 'rev_in':
        return this.revInGain;
      case 'ncl_in':
        return this.nclInGain;
      case 'zdb_in':
        return this.zdbInGain;
      case 'tap_in':
        return this.tapInGain;
      case 'lux_in':
        return this.luxInGain;
      case 'exc_in':
        return this.excInGain;
      case 'img_in':
        return this.imgInGain;
      case 'fin_in':
        return this.finInGain;
    }
  }

  private jackToModule(jack: string): RackModuleId {
    if (jack.startsWith('player')) return 'player';
    if (jack.startsWith('amp')) return 'amp';
    if (jack.startsWith('cmp')) return 'compressor';
    if (jack.startsWith('eq')) return 'eq';
    if (jack.startsWith('null')) return 'phaseNull';
    if (jack.startsWith('spc')) return 'acousticSpace';
    if (jack.startsWith('rev')) return 'revAmp';
    if (jack.startsWith('ncl')) return 'negMaster';
    if (jack.startsWith('zdb')) return 'zeroDbBus';
    if (jack.startsWith('tap')) return 'tapeSat';
    if (jack.startsWith('lux')) return 'luxuryVerb';
    if (jack.startsWith('exc')) return 'harmonicExciter';
    if (jack.startsWith('img')) return 'stereoImager';
    if (jack.startsWith('fin')) return 'luxuryMaster';
    return 'exporter';
  }

  public wouldCreateCycle(cables: PatchCable[]): boolean {
    const adj = new Map<RackModuleId, RackModuleId[]>();
    for (const c of cables) {
      const u = this.jackToModule(c.from);
      const v = this.jackToModule(c.to);
      if (u === v) return true;
      const list = adj.get(u) ?? [];
      list.push(v);
      adj.set(u, list);
    }
    const visiting = new Set<RackModuleId>();
    const visited = new Set<RackModuleId>();
    const dfs = (node: RackModuleId): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      for (const next of adj.get(node) ?? []) {
        if (dfs(next)) return true;
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    };
    for (const key of adj.keys()) {
      if (dfs(key)) return true;
    }
    return false;
  }

  public rewirePatchbay(cables: PatchCable[]) {
    this.cables = cables.map((c) => ({ ...c }));
    if (!this.ctx) return;

    const outputs: OutputJackId[] = [
      'player_out',
      'amp_out',
      'cmp_out',
      'eq_out',
      'null_out',
      'spc_out',
      'rev_out',
      'ncl_out',
      'zdb_out',
      'tap_out',
      'lux_out',
      'exc_out',
      'img_out',
      'fin_out',
    ];
    const inputs: InputJackId[] = [
      'amp_in',
      'cmp_in',
      'eq_in',
      'exp_in',
      'null_in',
      'spc_in',
      'rev_in',
      'ncl_in',
      'zdb_in',
      'tap_in',
      'lux_in',
      'exc_in',
      'img_in',
      'fin_in',
    ];

    for (const outId of outputs) {
      const outNode = this.getOutputNode(outId);
      if (!outNode) continue;
      for (const inId of inputs) {
        const inNode = this.getInputNode(inId);
        if (!inNode) continue;
        try {
          outNode.disconnect(inNode);
        } catch {
          // Not previously connected
        }
      }
    }

    for (const cable of cables) {
      const outNode = this.getOutputNode(cable.from);
      const inNode = this.getInputNode(cable.to);
      if (outNode && inNode) {
        outNode.connect(inNode);
      }
    }
  }

  private cleanupFallbackAudio() {
    if (this.fallbackAudioEl) {
      try {
        this.fallbackAudioEl.pause();
        this.fallbackAudioEl.onended = null;
        this.fallbackAudioEl.src = '';
      } catch {
        // ignore
      }
      this.fallbackAudioEl = null;
    }
    if (this.fallbackMediaSource) {
      try {
        this.fallbackMediaSource.disconnect();
      } catch {
        // ignore
      }
      this.fallbackMediaSource = null;
    }
    if (this.fallbackObjectUrl) {
      URL.revokeObjectURL(this.fallbackObjectUrl);
      this.fallbackObjectUrl = null;
    }
    this.fallbackDuration = 0;
  }

  private async decodeLoadedFileInBackground(file: File) {
    if (!this.ctx || file.size > 25 * 1024 * 1024) return;
    try {
      const ab = await file.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(ab.slice(0));
      if (this.loadedFile === file) {
        this.loadedAudioBuffer = buf;
      }
    } catch {
      // Streaming element remains active even if decodeAudioData cannot decode container
    }
  }

  public async loadAudioFile(file: File): Promise<{ name: string; duration: number }> {
    const ctx = await this.ensureContext();
    this.stopLoadedFile(true);
    this.cleanupFallbackAudio();
    this.loadedAudioBuffer = null;
    this.loadedFile = file;

    const objectUrl = URL.createObjectURL(file);
    const audioEl = new Audio();
    audioEl.crossOrigin = 'anonymous';
    audioEl.preload = 'auto';
    audioEl.loop = this.params.player.loop;
    audioEl.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        audioEl.removeEventListener('loadedmetadata', onReady);
        audioEl.removeEventListener('canplay', onReady);
        audioEl.removeEventListener('error', onErr);
        window.clearTimeout(timeout);
      };
      const onReady = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onErr = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`Unable to open "${file.name}". Unsupported audio format.`));
      };
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        // Resolve gracefully so streaming can still start on Play
        resolve();
      }, 2500);

      if (audioEl.readyState >= 1) {
        onReady();
        return;
      }
      audioEl.addEventListener('loadedmetadata', onReady, { once: true });
      audioEl.addEventListener('canplay', onReady, { once: true });
      audioEl.addEventListener('error', onErr, { once: true });
    });

    const mediaSrc = ctx.createMediaElementSource(audioEl);
    mediaSrc.connect(this.playerOutGain!);
    audioEl.onended = () => {
      if (!audioEl.loop) {
        this.isFilePlaying = false;
        this.filePlayOffset = 0;
      }
    };

    this.fallbackObjectUrl = objectUrl;
    this.fallbackAudioEl = audioEl;
    this.fallbackMediaSource = mediaSrc;
    this.fallbackDuration = Number.isFinite(audioEl.duration) ? audioEl.duration : 0;
    this.loadedFileName = file.name;
    this.filePlayOffset = 0;

    // Decode into offline buffer lazily in the background for WAV export
    void this.decodeLoadedFileInBackground(file);

    return { name: file.name, duration: this.fallbackDuration };
  }

  public getLoadedFileInfo(): { name: string | null; duration: number; isPlaying: boolean } {
    return {
      name: this.loadedFileName,
      duration: this.loadedAudioBuffer?.duration ?? this.fallbackDuration,
      isPlaying: this.isFilePlaying,
    };
  }

  public async playLoadedFile(): Promise<boolean> {
    if (!this.loadedAudioBuffer && !this.fallbackAudioEl) return false;
    const ctx = await this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (this.fallbackAudioEl) {
      this.fallbackAudioEl.loop = this.params.player.loop;
      await this.fallbackAudioEl.play();
      this.isFilePlaying = true;
      return true;
    }

    if (!this.loadedAudioBuffer) return false;
    this.stopLoadedFile(false);

    const src = ctx.createBufferSource();
    src.buffer = this.loadedAudioBuffer;
    src.loop = this.params.player.loop;
    src.connect(this.playerOutGain!);

    const dur = Math.max(0.01, this.loadedAudioBuffer.duration);
    const offset = Math.min(Math.max(0, this.filePlayOffset), Math.max(0, dur - 0.02));
    src.start(0, offset);
    this.filePlayStartedAt = ctx.currentTime - offset;
    this.bufferSource = src;
    this.isFilePlaying = true;

    src.onended = () => {
      if (this.bufferSource === src) {
        this.isFilePlaying = false;
        this.filePlayOffset = 0;
      }
    };
    return true;
  }

  public pauseLoadedFile() {
    if (this.fallbackAudioEl) {
      this.fallbackAudioEl.pause();
      this.filePlayOffset = this.fallbackAudioEl.currentTime;
      this.isFilePlaying = false;
      return;
    }
    if (!this.ctx || !this.isFilePlaying) return;
    const dur = this.loadedAudioBuffer?.duration || 1;
    const elapsed = this.ctx.currentTime - this.filePlayStartedAt;
    this.filePlayOffset = this.params.player.loop ? elapsed % dur : Math.min(dur, elapsed);
    this.stopLoadedFile(false);
  }

  public stopLoadedFile(resetOffset = true) {
    if (this.fallbackAudioEl) {
      this.fallbackAudioEl.pause();
      if (resetOffset) {
        this.fallbackAudioEl.currentTime = 0;
        this.filePlayOffset = 0;
      }
      this.isFilePlaying = false;
    }
    if (this.bufferSource) {
      try {
        this.bufferSource.onended = null;
        this.bufferSource.stop();
        this.bufferSource.disconnect();
      } catch {
        // Ignore already stopped
      }
      this.bufferSource = null;
    }
    this.isFilePlaying = false;
    if (resetOffset) this.filePlayOffset = 0;
  }

  public async seekLoadedFile(normalizedPos: number) {
    const clamped = Math.max(0, Math.min(0.999, normalizedPos));
    if (this.fallbackAudioEl) {
      const dur = Number.isFinite(this.fallbackAudioEl.duration)
        ? this.fallbackAudioEl.duration
        : this.fallbackDuration;
      if (dur > 0) {
        this.fallbackAudioEl.currentTime = clamped * dur;
        this.filePlayOffset = this.fallbackAudioEl.currentTime;
      }
      return;
    }
    if (!this.loadedAudioBuffer) return;
    const wasPlaying = this.isFilePlaying;
    this.stopLoadedFile(false);
    this.filePlayOffset = clamped * this.loadedAudioBuffer.duration;
    if (wasPlaying) {
      await this.playLoadedFile();
    }
  }

  public getPlaybackProgress(): { currentSec: number; durationSec: number } {
    if (this.fallbackAudioEl) {
      const dur = Number.isFinite(this.fallbackAudioEl.duration)
        ? this.fallbackAudioEl.duration
        : this.fallbackDuration;
      return {
        currentSec: Math.min(dur || 0, this.fallbackAudioEl.currentTime || 0),
        durationSec: dur || 0,
      };
    }
    if (!this.loadedAudioBuffer) return { currentSec: 0, durationSec: 0 };
    const dur = this.loadedAudioBuffer.duration;
    if (!this.isFilePlaying || !this.ctx) {
      return { currentSec: Math.min(dur, this.filePlayOffset), durationSec: dur };
    }
    const elapsed = this.ctx.currentTime - this.filePlayStartedAt;
    const currentSec = this.params.player.loop ? elapsed % dur : Math.min(dur, elapsed);
    return { currentSec, durationSec: dur };
  }

  public async toggleBusRecording(): Promise<{ recording: boolean; capturedSec: number }> {
    const ctx = await this.ensureContext();
    if (!this.isRecordingBus) {
      this.recordedLeft = [];
      this.recordedRight = [];
      this.recordedClip = null;
      this.isRecordingBus = true;
      return { recording: true, capturedSec: 0 };
    }

    this.isRecordingBus = false;
    const total = this.recordedLeft.reduce((acc, c) => acc + c.length, 0);
    if (total > 0) {
      const left = new Float32Array(total);
      const right = new Float32Array(total);
      let off = 0;
      for (let i = 0; i < this.recordedLeft.length; i++) {
        left.set(this.recordedLeft[i], off);
        right.set(this.recordedRight[i], off);
        off += this.recordedLeft[i].length;
      }
      this.recordedClip = { left, right, sampleRate: ctx.sampleRate };
      return { recording: false, capturedSec: Number((total / ctx.sampleRate).toFixed(2)) };
    }
    return { recording: false, capturedSec: 0 };
  }

  public clearRecordedClip() {
    this.recordedClip = null;
  }

  public async toggleDrone(): Promise<boolean> {
    const ctx = await this.ensureContext();
    if (this.isDronePlaying) {
      this.stopDrone();
      return false;
    }

    const freqs = [54, 108, 216, 432];
    const gain = ctx.createGain();
    gain.gain.value = 0.16;
    gain.connect(this.playerOutGain!);
    this.droneGain = gain;

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      g.gain.value = 1 / (idx + 1);
      osc.connect(g);
      g.connect(gain);
      osc.start();
      this.droneOscs.push(osc);
    });

    this.isDronePlaying = true;
    return true;
  }

  public stopDrone() {
    for (const osc of this.droneOscs) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore
      }
    }
    this.droneOscs = [];
    if (this.droneGain) {
      try {
        this.droneGain.disconnect();
      } catch {
        // ignore
      }
      this.droneGain = null;
    }
    this.isDronePlaying = false;
  }

  public async toggleMic(): Promise<boolean> {
    if (this.isMicActive) {
      this.stopMic();
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone API is unavailable in this browser.');
    }
    const ctx = await this.ensureContext();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const src = ctx.createMediaStreamSource(stream);
    src.connect(this.playerOutGain!);
    this.micStream = stream;
    this.micSource = src;
    this.isMicActive = true;
    return true;
  }

  public stopMic() {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // ignore
      }
      this.micSource = null;
    }
    if (this.micStream) {
      for (const track of this.micStream.getTracks()) {
        track.stop();
      }
      this.micStream = null;
    }
    this.isMicActive = false;
  }

  public async toggleTestTone(): Promise<boolean> {
    const ctx = await this.ensureContext();
    if (this.isTestTonePlaying) {
      this.stopTestTone();
      return false;
    }
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    osc.connect(gain);
    gain.connect(this.playerOutGain!);
    osc.start();
    this.testOsc = osc;
    this.testOscGain = gain;
    this.isTestTonePlaying = true;
    return true;
  }

  public stopTestTone() {
    if (this.testOsc) {
      try {
        this.testOsc.stop();
        this.testOsc.disconnect();
      } catch {
        // ignore
      }
      this.testOsc = null;
    }
    if (this.testOscGain) {
      try {
        this.testOscGain.disconnect();
      } catch {
        // ignore
      }
      this.testOscGain = null;
    }
    this.isTestTonePlaying = false;
  }

  public async toggleWebmRecording(): Promise<{
    recording: boolean;
    blob?: Blob;
    filename?: string;
    durationSec?: number;
  }> {
    await this.ensureContext();
    if (!this.isRecordingWebm) {
      if (!this.webmDest || typeof MediaRecorder === 'undefined') {
        throw new Error('WebM MediaRecorder is not supported in this browser.');
      }
      this.webmChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(this.webmDest.stream, { mimeType });
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) this.webmChunks.push(ev.data);
      };
      rec.start(250);
      this.mediaRecorder = rec;
      this.isRecordingWebm = true;
      this.webmStartedAt = performance.now();
      return { recording: true };
    }

    const rec = this.mediaRecorder;
    this.isRecordingWebm = false;
    if (!rec) return { recording: false };

    const elapsedSec = Math.max(0.1, (performance.now() - this.webmStartedAt) * 0.001);
    const blob = await new Promise<Blob>((resolve) => {
      rec.onstop = () => {
        resolve(new Blob(this.webmChunks, { type: rec.mimeType || 'audio/webm' }));
      };
      rec.stop();
    });
    this.mediaRecorder = null;
    const base = (this.loadedFileName || 'aim_studio_master').replace(/\.[^.]+$/, '');
    return {
      recording: false,
      blob,
      filename: `${base}_master.webm`,
      durationSec: Number(elapsedSec.toFixed(1)),
    };
  }

  public getSourceStatus() {
    return {
      isDronePlaying: this.isDronePlaying,
      isTestTonePlaying: this.isTestTonePlaying,
      isMicActive: this.isMicActive,
      isFilePlaying: this.isFilePlaying,
      loadedFileName: this.loadedFileName,
      hasLoadedFile: Boolean(this.loadedAudioBuffer || this.fallbackAudioEl),
      isRecordingBus: this.isRecordingBus,
      hasRecordedClip: Boolean(this.recordedClip),
      isRecordingWebm: this.isRecordingWebm,
      webmElapsedSec: this.isRecordingWebm
        ? Math.max(0, (performance.now() - this.webmStartedAt) * 0.001)
        : 0,
    };
  }

  private measureAnalyserRms(an?: AnalyserNode): number {
    if (!an) return 0;
    an.getByteTimeDomainData(this.stageTimeBuf);
    let sumSq = 0;
    for (let i = 0; i < this.stageTimeBuf.length; i++) {
      const norm = (this.stageTimeBuf[i] - 128) / 128;
      sumSq += norm * norm;
    }
    return Math.min(1, Math.sqrt(sumSq / this.stageTimeBuf.length) * 2.6);
  }

  public sampleTelemetry(wallClockSec: number): AudioTelemetry {
    const cmp = this.params.compressor;
    const presetCfg = SENSITIVITY_PRESETS[cmp.preset] || SENSITIVITY_PRESETS.bass;

    let bass = 0;
    let mid = 0;
    let treble = 0;
    const freqBins = new Array<number>(32).fill(0);

    if (this.masterAnalyser && this.masterFreqData) {
      this.masterAnalyser.getByteFrequencyData(this.masterFreqData);
      for (let i = 0; i < 12; i++) bass += this.masterFreqData[i];
      for (let i = 12; i < 48; i++) mid += this.masterFreqData[i];
      for (let i = 48; i < 110; i++) treble += this.masterFreqData[i];
      bass = (bass / (12 * 255)) * (0.5 + cmp.s1Condense * 0.8);
      mid = (mid / (36 * 255)) * (0.5 + cmp.s2Condense * 0.8);
      treble = (treble / (62 * 255)) * (0.5 + cmp.s3Condense * 0.8);

      for (let b = 0; b < 32; b++) {
        const idx = Math.min(this.masterFreqData.length - 1, Math.floor((b / 32) * 96));
        freqBins[b] = this.masterFreqData[idx] / 255;
      }
    }

    const weightSum = Math.max(0.1, presetCfg.bassWeight + presetCfg.midWeight);
    const rawTransientEnergy =
      (bass * presetCfg.bassWeight + mid * presetCfg.midWeight) / weightSum;

    const effectiveThreshold = Math.max(
      presetCfg.minFloor,
      this.beatState.transientAvg * cmp.beatSensitivity
    );

    const hasActiveAudio =
      this.params.masterPower &&
      (this.isDronePlaying || this.isTestTonePlaying || this.isMicActive || this.isFilePlaying);
    let beatTriggeredNow = false;

    if (hasActiveAudio) {
      const isTransientPeak =
        rawTransientEnergy >= effectiveThreshold &&
        wallClockSec - this.beatState.lastBeatTime > presetCfg.cooldown;

      if (cmp.autoBeatShockwaves && isTransientPeak) {
        this.beatState.lastBeatTime = wallClockSec;
        this.beatState.beatCount += 1;
        beatTriggeredNow = true;
        this.onBeatCallback?.();
      }

      const alpha = rawTransientEnergy > this.beatState.transientAvg ? 0.045 : 0.13;
      this.beatState.transientAvg =
        this.beatState.transientAvg * (1 - alpha) + rawTransientEnergy * alpha;
    } else {
      this.beatState.transientAvg *= 0.95;
    }

    this.beatState.isBeatTriggered = beatTriggeredNow;
    const boostGain = cmp.preset === 'quiet' ? 1.65 : cmp.preset === 'vocal' ? 1.25 : 1.0;
    const displayedEnergy = Math.min(1.0, rawTransientEnergy * boostGain);
    this.beatState.smoothedMeterEnergy =
      this.beatState.smoothedMeterEnergy * 0.76 + displayedEnergy * 0.24;

    const playerLevel = this.measureAnalyserRms(this.stageAnalysers.player_out);
    const ampLevel = this.measureAnalyserRms(this.stageAnalysers.amp_out);
    const cmpLevel = this.measureAnalyserRms(this.stageAnalysers.cmp_out);
    const eqLevel = this.measureAnalyserRms(this.stageAnalysers.eq_out);
    const nullLevel = this.measureAnalyserRms(this.stageAnalysers.null_out);
    const spcLevel = this.measureAnalyserRms(this.stageAnalysers.spc_out);
    const revLevel = this.measureAnalyserRms(this.stageAnalysers.rev_out);
    const nclLevel = this.measureAnalyserRms(this.stageAnalysers.ncl_out);
    const zdbLevel = this.measureAnalyserRms(this.stageAnalysers.zdb_out);
    const tapLevel = this.measureAnalyserRms(this.stageAnalysers.tap_out);
    const luxLevel = this.measureAnalyserRms(this.stageAnalysers.lux_out);
    const excLevel = this.measureAnalyserRms(this.stageAnalysers.exc_out);
    const imgLevel = this.measureAnalyserRms(this.stageAnalysers.img_out);
    const finLevel = this.measureAnalyserRms(this.stageAnalysers.fin_out);
    const expLevel = this.measureAnalyserRms(this.stageAnalysers.exp_in);

    // Measure live L/R stereo correlation from IMG-14
    let stereoCorrelation = 1.0;
    if (this.imgLeftAnalyser && this.imgRightAnalyser) {
      this.imgLeftAnalyser.getByteTimeDomainData(this.corrTimeBufL);
      this.imgRightAnalyser.getByteTimeDomainData(this.corrTimeBufR);
      let num = 0;
      let denL = 0;
      let denR = 0;
      for (let i = 0; i < this.corrTimeBufL.length; i++) {
        const x = (this.corrTimeBufL[i] - 128) / 128;
        const y = (this.corrTimeBufR[i] - 128) / 128;
        num += x * y;
        denL += x * x;
        denR += y * y;
      }
      const denom = Math.sqrt(denL * denR);
      if (denom > 0.0005) {
        stereoCorrelation = Number(Math.max(-1, Math.min(1, num / denom)).toFixed(2));
      }
    }

    const bandSpaceLevels: [number, number, number, number] = [
      this.measureAnalyserRms(this.spcBands[0]?.analyser),
      this.measureAnalyserRms(this.spcBands[1]?.analyser),
      this.measureAnalyserRms(this.spcBands[2]?.analyser),
      this.measureAnalyserRms(this.spcBands[3]?.analyser),
    ];

    const levelByOutput: Record<OutputJackId, number> = {
      player_out: playerLevel,
      amp_out: ampLevel,
      cmp_out: cmpLevel,
      eq_out: eqLevel,
      null_out: nullLevel,
      spc_out: spcLevel,
      rev_out: revLevel,
      ncl_out: nclLevel,
      zdb_out: zdbLevel,
      tap_out: tapLevel,
      lux_out: luxLevel,
      exc_out: excLevel,
      img_out: imgLevel,
      fin_out: finLevel,
    };

    const cableEnergy: Record<string, number> = {};
    for (const c of this.cables) {
      cableEnergy[c.id] = levelByOutput[c.from] ?? 0;
    }

    const orderedEnv: number[] = [];
    const traceLen = this.dspState.envTrace.length;
    for (let i = 0; i < traceLen; i++) {
      orderedEnv.push(this.dspState.envTrace[(this.dspState.envIdx + i) % traceLen]);
    }

    const tapeSaturationPct = this.params.tapeSat.power
      ? Math.round(Math.min(100, (this.params.tapeSat.saturation * 65 + tapLevel * 45)))
      : 0;
    const luxRoomLevel = this.params.luxuryVerb.power
      ? Math.min(1, luxLevel * (0.5 + this.params.luxuryVerb.mix))
      : 0;

    return {
      bass,
      mid,
      treble,
      rms: expLevel,
      peak: Math.max(
        playerLevel,
        ampLevel,
        cmpLevel,
        eqLevel,
        nullLevel,
        spcLevel,
        revLevel,
        nclLevel,
        zdbLevel,
        tapLevel,
        luxLevel,
        excLevel,
        imgLevel,
        finLevel,
        expLevel
      ),
      isSilentGap: this.dspState.isSilentGap,
      gapCondensePct: cmp.power && cmp.hyperEnabled ? this.dspState.gapCondensePct : 0,
      waveRoundVal: this.dspState.waveRoundVal,
      sonicSegmentCount: this.dspState.sonicSegmentCount,
      beatCount: this.beatState.beatCount,
      beatEnergy: this.beatState.smoothedMeterEnergy,
      effectiveThreshold: Math.min(0.96, effectiveThreshold * boostGain),
      isBeatTriggered: beatTriggeredNow,
      freqBins,
      envTrace: orderedEnv,
      cableEnergy,
      moduleLevels: {
        player: playerLevel,
        amp: ampLevel,
        compressor: cmpLevel,
        eq: eqLevel,
        exporter: expLevel,
        phaseNull: nullLevel,
        acousticSpace: spcLevel,
        revAmp: revLevel,
        negMaster: nclLevel,
        zeroDbBus: zdbLevel,
        tapeSat: tapLevel,
        luxuryVerb: luxLevel,
        harmonicExciter: excLevel,
        stereoImager: imgLevel,
        luxuryMaster: finLevel,
      },
      hasActiveAudio,
      silenceAmpDb: this.dspState.silenceAmpDb,
      trueZeroProximity: this.dspState.trueZeroProximity,
      negLiftDb: this.dspState.negLiftDb,
      bandSpaceLevels,
      tapeSaturationPct,
      luxRoomLevel,
      stereoCorrelation,
      sslVcaGrDb:
        this.sovVcaComp && !this.params.sovereignChain.bypass.vcaComp
          ? Math.max(0, Math.min(18, Math.abs(this.sovVcaComp.reduction || 0)))
          : 0,
    };
  }

  /**
   * Renders audio offline through both Cabinet I and Cabinet II patchbay routing,
   * including 4-band acoustic space separation, reversed-frequency silence amplification,
   * and true-0dB negative compressor/limiter/gate mastering, then encodes to 128k WAV.
   */
  public async exportSculptedWav(formatOverride?: WavExportFormat): Promise<{
    blob: Blob;
    filename: string;
    bitrateKbps: number;
    sampleRate: number;
    bitsPerSample: 8 | 16;
    channels: number;
    durationSec: number;
  }> {
    const params = this.params;
    const format = formatOverride ?? params.exporter.format;

    if (this.recordedClip && !this.loadedAudioBuffer) {
      const left = new Float32Array(this.recordedClip.left);
      const right = new Float32Array(this.recordedClip.right);
      const srcRate = this.recordedClip.sampleRate;

      if (params.exporter.normalize) {
        let peak = 0;
        for (let i = 0; i < left.length; i++) {
          peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
        }
        if (peak > 0.001) {
          const scale = 0.99 / peak;
          for (let i = 0; i < left.length; i++) {
            left[i] *= scale;
            right[i] *= scale;
          }
        }
      }

      return this.encodeAndPackageWav(left, right, srcRate, format, 'monolith_live_capture');
    }

    const renderRate = 44100;
    let durationSec = 6.0;
    if (!this.loadedAudioBuffer && this.loadedFile && this.ctx) {
      try {
        const ab = await this.loadedFile.arrayBuffer();
        this.loadedAudioBuffer = await this.ctx.decodeAudioData(ab.slice(0));
      } catch {
        // Fallback to synth/recorded clip if browser cannot decode container offline
      }
    }
    const sourceBuf: AudioBuffer | null = this.loadedAudioBuffer;
    if (sourceBuf) {
      durationSec = Math.min(90, sourceBuf.duration);
    }

    const totalSamples = Math.max(1, Math.floor(durationSec * renderRate));
    const offline = new OfflineAudioContext(2, totalSamples, renderRate);

    const pOut = offline.createGain();
    pOut.gain.value = params.player.inputTrim;

    if (sourceBuf) {
      const src = offline.createBufferSource();
      src.buffer = sourceBuf;
      src.connect(pOut);
      src.start(0);
    } else {
      const freqs = [54, 108, 216, 432];
      const synthG = offline.createGain();
      synthG.gain.value = 0.22;
      synthG.connect(pOut);
      freqs.forEach((f, idx) => {
        const osc = offline.createOscillator();
        const g = offline.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.value = f;
        g.gain.value = 1 / (idx + 1);
        osc.connect(g);
        g.connect(synthG);
        osc.start(0);
      });
    }

    // Offline Amp
    const ampIn = offline.createGain();
    const ampHpf = offline.createBiquadFilter();
    ampHpf.type = 'highpass';
    ampHpf.frequency.value = params.amp.power && params.amp.hpfEnabled ? 75 : 18;
    const ampShaper = offline.createWaveShaper();
    ampShaper.curve = params.amp.power
      ? createTubeCurve(params.amp.drive, params.amp.bias)
      : createTubeCurve(0, 0);
    const ampOut = offline.createGain();
    ampOut.gain.value = params.amp.power ? params.amp.outputGain : 1.0;
    ampIn.connect(ampHpf);
    ampHpf.connect(ampShaper);
    ampShaper.connect(ampOut);

    // Offline Compressor
    const cmpIn = offline.createGain();
    const cmpNode = offline.createDynamicsCompressor();
    if (params.compressor.power) {
      cmpNode.threshold.value = params.compressor.threshold;
      cmpNode.ratio.value = params.compressor.ratio;
      cmpNode.attack.value = params.compressor.attack;
      cmpNode.release.value = params.compressor.release;
    } else {
      cmpNode.threshold.value = 0;
      cmpNode.ratio.value = 1;
    }
    const cmpOut = offline.createGain();
    cmpOut.gain.value = params.compressor.power ? params.compressor.makeupGain : 1.0;
    cmpIn.connect(cmpNode);
    cmpNode.connect(cmpOut);

    // Offline EQ
    const eqIn = offline.createGain();
    const mul = params.eq.power ? 1 : 0;
    const eqLow = offline.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 60;
    eqLow.gain.value = params.eq.lowGain * mul;

    const eqLM = offline.createBiquadFilter();
    eqLM.type = 'peaking';
    eqLM.frequency.value = 350;
    eqLM.Q.value = 1.0;
    eqLM.gain.value = params.eq.lowMidGain * mul;

    const eqHM = offline.createBiquadFilter();
    eqHM.type = 'peaking';
    eqHM.frequency.value = 2400;
    eqHM.Q.value = params.eq.presenceQ;
    eqHM.gain.value = params.eq.highMidGain * mul;

    const eqHigh = offline.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 10000;
    eqHigh.gain.value = params.eq.highGain * mul;

    const eqOut = offline.createGain();
    eqIn.connect(eqLow);
    eqLow.connect(eqLM);
    eqLM.connect(eqHM);
    eqHM.connect(eqHigh);
    eqHigh.connect(eqOut);

    // Offline Cabinet II: Phase Null & Acoustic Space 4-Band Splitter
    const nullIn = offline.createGain();
    const nullOut = offline.createGain();
    nullOut.gain.value = params.phaseNull.power && params.phaseNull.polarityInvert ? -1 : 1;
    nullIn.connect(nullOut);

    const spcIn = offline.createGain();
    const spcOut = offline.createGain();
    if (!params.acousticSpace.power) {
      spcIn.connect(spcOut);
    } else {
      const spc = params.acousticSpace;
      const bandSpecs: Array<{
        type: BiquadFilterType;
        freq: number;
        q: number;
        cfg: AcousticBandSpace;
      }> = [
        { type: 'lowpass', freq: 180, q: 0.707, cfg: spc.low },
        { type: 'bandpass', freq: 420, q: 0.9, cfg: spc.lowMid },
        { type: 'bandpass', freq: 2100, q: 0.9, cfg: spc.highMid },
        { type: 'highpass', freq: 4200, q: 0.707, cfg: spc.high },
      ];
      const anySolo = bandSpecs.some((b) => b.cfg.solo);
      for (const b of bandSpecs) {
        const flt = offline.createBiquadFilter();
        flt.type = b.type;
        flt.frequency.value = b.freq;
        flt.Q.value = b.q;

        const dly = offline.createDelay(0.06);
        dly.delayTime.value = Math.max(
          0,
          Math.min(0.04, b.cfg.spaceDepth * 0.024 * spc.roomWidth)
        );
        const pan = offline.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, b.cfg.pan * spc.roomWidth));
        const g = offline.createGain();
        const active = b.cfg.enabled && (!anySolo || b.cfg.solo);
        g.gain.value = active ? b.cfg.negGain : 0;

        spcIn.connect(flt);
        flt.connect(dly);
        dly.connect(pan);
        pan.connect(g);
        g.connect(spcOut);
      }
    }

    const revIn = offline.createGain();
    const revLow = offline.createBiquadFilter();
    revLow.type = 'lowshelf';
    revLow.frequency.value = params.revAmp.mirrorPivotHz;
    revLow.gain.value = params.revAmp.power ? -params.revAmp.reverseFreq * 9.0 : 0;
    const revHigh = offline.createBiquadFilter();
    revHigh.type = 'highshelf';
    revHigh.frequency.value = params.revAmp.mirrorPivotHz;
    revHigh.gain.value = params.revAmp.power ? params.revAmp.reverseFreq * 9.0 : 0;
    const revOut = offline.createGain();
    revIn.connect(revLow);
    revLow.connect(revHigh);
    revHigh.connect(revOut);

    const nclIn = offline.createGain();
    const nclOut = offline.createGain();
    nclIn.connect(nclOut);

    const zdbIn = offline.createGain();
    const zdbOut = offline.createGain();
    const zdbSign = params.zeroDbBus.phaseCoherence < -0.5 ? -1 : 1;
    zdbOut.gain.value = params.zeroDbBus.power ? params.zeroDbBus.busTrim * zdbSign : 1.0;
    zdbIn.connect(zdbOut);

    // Offline Cabinet III: Luxury Mastering Suite
    const tapIn = offline.createGain();
    const tapBump = offline.createBiquadFilter();
    tapBump.type = 'lowshelf';
    tapBump.frequency.value = params.tapeSat.ips30 ? 55 : 95;
    tapBump.gain.value = params.tapeSat.power ? params.tapeSat.warmth * (params.tapeSat.ips30 ? 2.2 : 4.2) : 0;
    const tapShp = offline.createWaveShaper();
    tapShp.curve = params.tapeSat.power
      ? createTapeSaturationCurve(params.tapeSat.saturation, params.tapeSat.warmth)
      : createTapeSaturationCurve(0, 0);
    const tapOut = offline.createGain();
    tapIn.connect(tapBump);
    tapBump.connect(tapShp);
    tapShp.connect(tapOut);

    const luxIn = offline.createGain();
    const luxDry = offline.createGain();
    const luxWet = offline.createGain();
    const luxPre = offline.createDelay(0.15);
    const luxConv = offline.createConvolver();
    luxConv.buffer = createLuxuryHallIR(
      offline,
      params.luxuryVerb.decaySec,
      params.luxuryVerb.shimmer,
      params.luxuryVerb.stereoSpread
    );
    const luxOut = offline.createGain();
    const wetLvl = params.luxuryVerb.power ? Math.max(0, Math.min(0.85, params.luxuryVerb.mix)) : 0;
    luxDry.gain.value = params.luxuryVerb.power ? 1 - wetLvl * 0.35 : 1.0;
    luxWet.gain.value = wetLvl;
    luxPre.delayTime.value = Math.max(0, Math.min(0.12, params.luxuryVerb.preDelayMs * 0.001));
    luxIn.connect(luxDry);
    luxDry.connect(luxOut);
    luxIn.connect(luxPre);
    luxPre.connect(luxConv);
    luxConv.connect(luxWet);
    luxWet.connect(luxOut);

    const excIn = offline.createGain();
    const excDry = offline.createGain();
    const excHp = offline.createBiquadFilter();
    excHp.type = 'highpass';
    excHp.frequency.value = params.harmonicExciter.tuneHz;
    const excShp = offline.createWaveShaper();
    excShp.curve = createExciterCurve(params.harmonicExciter.harmonics, params.harmonicExciter.tubeOddEven);
    const excHarmG = offline.createGain();
    excHarmG.gain.value = params.harmonicExciter.power ? params.harmonicExciter.harmonics * 0.32 : 0;
    const excAir = offline.createBiquadFilter();
    excAir.type = 'highshelf';
    excAir.frequency.value = 11000;
    excAir.gain.value = params.harmonicExciter.power ? params.harmonicExciter.airGainDb * 0.65 : 0;
    const excOut = offline.createGain();
    excIn.connect(excDry);
    excDry.connect(excAir);
    excIn.connect(excHp);
    excHp.connect(excShp);
    excShp.connect(excHarmG);
    excHarmG.connect(excAir);
    excAir.connect(excOut);

    const imgIn = offline.createGain();
    const imgOut = offline.createGain();
    imgIn.connect(imgOut);

    const finIn = offline.createGain();
    const finLim = offline.createWaveShaper();
    const finCeil = Math.pow(10, Math.min(0, params.luxuryMaster.ceilingDb) / 20);
    finLim.curve = params.luxuryMaster.power ? createZeroDbLimiterCurve(finCeil) : createZeroDbLimiterCurve(1.0);
    const finOut = offline.createGain();
    finIn.connect(finLim);
    finLim.connect(finOut);

    const expIn = offline.createGain();
    const masterG = offline.createGain();
    masterG.gain.value = params.exporter.masterVolume;
    expIn.connect(masterG);
    masterG.connect(offline.destination);

    const outMap: Record<OutputJackId, AudioNode> = {
      player_out: pOut,
      amp_out: ampOut,
      cmp_out: cmpOut,
      eq_out: eqOut,
      null_out: nullOut,
      spc_out: spcOut,
      rev_out: revOut,
      ncl_out: nclOut,
      zdb_out: zdbOut,
      tap_out: tapOut,
      lux_out: luxOut,
      exc_out: excOut,
      img_out: imgOut,
      fin_out: finOut,
    };
    const inMap: Record<InputJackId, AudioNode> = {
      amp_in: ampIn,
      cmp_in: cmpIn,
      eq_in: eqIn,
      exp_in: expIn,
      null_in: nullIn,
      spc_in: spcIn,
      rev_in: revIn,
      ncl_in: nclIn,
      zdb_in: zdbIn,
      tap_in: tapIn,
      lux_in: luxIn,
      exc_in: excIn,
      img_in: imgIn,
      fin_in: finIn,
    };

    for (const c of this.cables) {
      outMap[c.from]?.connect(inMap[c.to]);
    }

    const rendered = await offline.startRendering();
    const left = new Float32Array(rendered.getChannelData(0));
    const right = new Float32Array(
      rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : rendered.getChannelData(0)
    );

    // Deterministic offline post-pass for Cabinet II Reversed-Frequency Silence Amp & Negative Master
    const cab2Wired = this.cables.some(
      (c) =>
        c.from === 'rev_out' ||
        c.from === 'ncl_out' ||
        c.from === 'zdb_out' ||
        c.to === 'rev_in' ||
        c.to === 'ncl_in'
    );
    if (cab2Wired && (params.revAmp.power || params.negMaster.power)) {
      let env = 0.002;
      let lpL = 0;
      let lpR = 0;
      let smoothG = 1.0;
      const floor = Math.max(0.015, params.phaseNull.nullFloor * 2.0);
      const ceilLin = Math.pow(10, Math.min(0, params.negMaster.limiterCeilingDb) / 20);
      const invRatioTerm = 1 - 1 / Math.max(1, params.negMaster.invRatio);
      const fc = Math.max(200, Math.min(6000, params.revAmp.mirrorPivotHz));
      const lpAlpha = 1 - Math.exp((-2 * Math.PI * fc) / renderRate);

      for (let i = 0; i < left.length; i++) {
        let sL = left[i];
        let sR = right[i];
        const abs = Math.max(Math.abs(sL), Math.abs(sR));
        env = Math.max(1e-5, env * 0.992 + abs * 0.008);

        if (params.revAmp.power) {
          lpL += lpAlpha * (sL - lpL);
          lpR += lpAlpha * (sR - lpR);
          const tiltL = lpL * (1 - params.revAmp.reverseFreq * 0.25) - (sL - lpL) * (params.revAmp.reverseFreq * 0.35);
          const tiltR = lpR * (1 - params.revAmp.reverseFreq * 0.25) - (sR - lpR) * (params.revAmp.reverseFreq * 0.35);
          sL = sL * (1 - params.revAmp.reverseFreq * 0.45) + tiltL * (params.revAmp.reverseFreq * 0.45);
          sR = sR * (1 - params.revAmp.reverseFreq * 0.45) + tiltR * (params.revAmp.reverseFreq * 0.45);

          const sil = Math.max(0, Math.min(1, 1 - env / floor));
          const lift = Math.pow(10, (params.revAmp.negAmpGainDb * sil) / 20);
          sL *= lift;
          sR *= lift;
        }

        if (params.negMaster.power) {
          const inDb = 20 * Math.log10(env);
          let targetG = 1.0;
          if (params.negMaster.gateInvert && inDb < params.negMaster.negThreshold && inDb > params.negMaster.gateFloorDb - 10) {
            const boostDb = Math.min(
              14,
              (params.negMaster.negThreshold - inDb) * invRatioTerm * params.negMaster.silenceLift * 0.55
            );
            targetG = Math.pow(10, boostDb / 20);
          }
          smoothG = smoothG * 0.96 + targetG * 0.04;
          sL *= smoothG;
          sR *= smoothG;

          const pk = Math.max(Math.abs(sL), Math.abs(sR));
          if (pk > ceilLin) {
            sL *= ceilLin / pk;
            sR *= ceilLin / pk;
          }
        }

        left[i] = Math.max(-1, Math.min(1, sL));
        right[i] = Math.max(-1, Math.min(1, sR));
      }
    }

    if (params.exporter.normalize) {
      let peak = 0;
      for (let i = 0; i < left.length; i++) {
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      }
      if (peak > 0.001) {
        const targetCeiling = params.zeroDbBus.trueZeroLock ? 0.995 : 0.96;
        const scale = targetCeiling / peak;
        for (let i = 0; i < left.length; i++) {
          left[i] *= scale;
          right[i] *= scale;
        }
      }
    }

    const baseName = (this.loadedFileName || 'monolith_dual_cab_master').replace(/\.[^.]+$/, '');
    return this.encodeAndPackageWav(left, right, renderRate, format, baseName);
  }

  private encodeAndPackageWav(
    left: Float32Array,
    right: Float32Array,
    srcRate: number,
    format: WavExportFormat,
    baseName: string
  ) {
    let targetRate = 8000;
    let bitsPerSample: 8 | 16 = 16;
    let channels: Float32Array[];

    if (format === '128k_16khz_8bit') {
      targetRate = 16000;
      bitsPerSample = 8;
      const mono = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) mono[i] = (left[i] + right[i]) * 0.5;
      channels = [resampleChannel(mono, srcRate, targetRate)];
    } else if (format === 'studio_44k_16bit') {
      targetRate = 44100;
      bitsPerSample = 16;
      channels = [
        resampleChannel(left, srcRate, targetRate),
        resampleChannel(right, srcRate, targetRate),
      ];
    } else {
      targetRate = 8000;
      bitsPerSample = 16;
      const mono = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) mono[i] = (left[i] + right[i]) * 0.5;
      channels = [resampleChannel(mono, srcRate, targetRate)];
    }

    const blob = encodeWavBuffer(channels, targetRate, bitsPerSample, this.params.exporter.dither);
    const bitrateKbps = Math.round((targetRate * bitsPerSample * channels.length) / 1000);
    return {
      blob,
      filename: `${baseName}_${bitrateKbps}k.wav`,
      bitrateKbps,
      sampleRate: targetRate,
      bitsPerSample,
      channels: channels.length,
      durationSec: Number((channels[0].length / targetRate).toFixed(2)),
    };
  }

  public dispose() {
    this.stopLoadedFile(true);
    this.cleanupFallbackAudio();
    this.stopDrone();
    this.stopTestTone();
    this.stopMic();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    if (this.tapFlutterOsc) {
      try {
        this.tapFlutterOsc.stop();
        this.tapFlutterOsc.disconnect();
      } catch {
        // ignore
      }
      this.tapFlutterOsc = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
