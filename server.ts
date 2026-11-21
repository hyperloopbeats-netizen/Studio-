import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'monolith-noir-studio', timestamp: new Date().toISOString() });
  });

  // AI Sound Engineer & Main Orchestrator endpoint powered by Gemini
  const bandSpaceSchema = {
    type: Type.OBJECT,
    properties: {
      enabled: { type: Type.BOOLEAN },
      solo: { type: Type.BOOLEAN },
      pan: { type: Type.NUMBER, description: '-1.0 (full left) to +1.0 (full right)' },
      spaceDepth: { type: Type.NUMBER, description: '0.0 to 1.0 Haas depth' },
      negGain: { type: Type.NUMBER, description: '-1.5 to +1.5 negative/positive band gain' },
    },
  };

  const clampNum = (v: unknown, min: number, max: number): number | undefined => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
    return Math.min(max, Math.max(min, v));
  };

  const sanitizeAiPlan = (raw: Record<string, unknown>) => {
    const out = { ...raw } as Record<string, unknown>;
    if (typeof out.player === 'object' && out.player) {
      const p = out.player as Record<string, unknown>;
      const t = clampNum(p.inputTrim, 0.2, 2.0);
      if (t !== undefined) p.inputTrim = t;
    }
    if (typeof out.amp === 'object' && out.amp) {
      const a = out.amp as Record<string, unknown>;
      const d = clampNum(a.drive, 0, 1);
      const b = clampNum(a.bias, -0.5, 0.5);
      const g = clampNum(a.outputGain, 0.2, 2.0);
      if (d !== undefined) a.drive = d;
      if (b !== undefined) a.bias = b;
      if (g !== undefined) a.outputGain = g;
    }
    if (typeof out.compressor === 'object' && out.compressor) {
      const c = out.compressor as Record<string, unknown>;
      const ranges: Record<string, [number, number]> = {
        threshold: [-48, 0],
        ratio: [1, 20],
        attack: [0.001, 0.25],
        release: [0.04, 1.0],
        makeupGain: [0.5, 2.5],
        beatSensitivity: [1.05, 2.5],
        gapCondense: [0, 1],
        waveRound: [0, 1],
        silenceFloor: [0.005, 0.25],
        dynamicDensity: [0, 1],
        waveFreqHz: [1, 24],
        s1Floor: [0.005, 0.25],
        s1Condense: [0, 1],
        s1Round: [0, 1],
        s2Floor: [0.005, 0.25],
        s2Condense: [0, 1],
        s2Round: [0, 1],
        s3Floor: [0.005, 0.25],
        s3Condense: [0, 1],
        s3Round: [0, 1],
        s4Density: [0, 1],
        s4WaveHz: [1, 24],
        s4SpliceRound: [0, 1],
      };
      for (const [k, [mn, mx]] of Object.entries(ranges)) {
        const val = clampNum(c[k], mn, mx);
        if (val !== undefined) c[k] = val;
      }
    }
    if (typeof out.eq === 'object' && out.eq) {
      const e = out.eq as Record<string, unknown>;
      for (const k of ['lowGain', 'lowMidGain', 'highMidGain', 'highGain']) {
        const val = clampNum(e[k], -12, 12);
        if (val !== undefined) e[k] = val;
      }
      const q = clampNum(e.presenceQ, 0.4, 4.0);
      if (q !== undefined) e.presenceQ = q;
    }
    if (typeof out.exporter === 'object' && out.exporter) {
      const x = out.exporter as Record<string, unknown>;
      const mv = clampNum(x.masterVolume, 0.0, 1.5);
      if (mv !== undefined) x.masterVolume = mv;
    }
    if (typeof out.phaseNull === 'object' && out.phaseNull) {
      const pn = out.phaseNull as Record<string, unknown>;
      const cd = clampNum(pn.cancelDepth, 0, 1);
      const nf = clampNum(pn.nullFloor, 0.002, 0.25);
      const zf = clampNum(pn.zeroDbFocus, 0, 1);
      if (cd !== undefined) pn.cancelDepth = cd;
      if (nf !== undefined) pn.nullFloor = nf;
      if (zf !== undefined) pn.zeroDbFocus = zf;
    }
    if (typeof out.acousticSpace === 'object' && out.acousticSpace) {
      const sp = out.acousticSpace as Record<string, unknown>;
      const rw = clampNum(sp.roomWidth, 0, 1.5);
      if (rw !== undefined) sp.roomWidth = rw;
      for (const bk of ['low', 'lowMid', 'highMid', 'high']) {
        if (typeof sp[bk] === 'object' && sp[bk]) {
          const b = sp[bk] as Record<string, unknown>;
          const pan = clampNum(b.pan, -1, 1);
          const sd = clampNum(b.spaceDepth, 0, 1);
          const ng = clampNum(b.negGain, -1.5, 1.5);
          if (pan !== undefined) b.pan = pan;
          if (sd !== undefined) b.spaceDepth = sd;
          if (ng !== undefined) b.negGain = ng;
        }
      }
    }
    if (typeof out.revAmp === 'object' && out.revAmp) {
      const r = out.revAmp as Record<string, unknown>;
      const rf = clampNum(r.reverseFreq, 0, 1);
      const ng = clampNum(r.negAmpGainDb, 0, 24);
      const mp = clampNum(r.mirrorPivotHz, 200, 6000);
      if (rf !== undefined) r.reverseFreq = rf;
      if (ng !== undefined) r.negAmpGainDb = ng;
      if (mp !== undefined) r.mirrorPivotHz = mp;
    }
    if (typeof out.negMaster === 'object' && out.negMaster) {
      const nm = out.negMaster as Record<string, unknown>;
      const nt = clampNum(nm.negThreshold, -60, -3);
      const ir = clampNum(nm.invRatio, 1, 20);
      const sl = clampNum(nm.silenceLift, 0, 1);
      const gf = clampNum(nm.gateFloorDb, -72, -12);
      const lc = clampNum(nm.limiterCeilingDb, -3, 0);
      if (nt !== undefined) nm.negThreshold = nt;
      if (ir !== undefined) nm.invRatio = ir;
      if (sl !== undefined) nm.silenceLift = sl;
      if (gf !== undefined) nm.gateFloorDb = gf;
      if (lc !== undefined) nm.limiterCeilingDb = lc;
    }
    if (typeof out.zeroDbBus === 'object' && out.zeroDbBus) {
      const z = out.zeroDbBus as Record<string, unknown>;
      const pc = clampNum(z.phaseCoherence, -1, 1);
      const bt = clampNum(z.busTrim, 0.2, 1.5);
      if (pc !== undefined) z.phaseCoherence = pc;
      if (bt !== undefined) z.busTrim = bt;
    }
    if (typeof out.tapeSat === 'object' && out.tapeSat) {
      const ts = out.tapeSat as Record<string, unknown>;
      const w = clampNum(ts.warmth, 0, 1);
      const s = clampNum(ts.saturation, 0, 1);
      const wf = clampNum(ts.wowFlutter, 0, 1);
      if (w !== undefined) ts.warmth = w;
      if (s !== undefined) ts.saturation = s;
      if (wf !== undefined) ts.wowFlutter = wf;
    }
    if (typeof out.luxuryVerb === 'object' && out.luxuryVerb) {
      const lv = out.luxuryVerb as Record<string, unknown>;
      const m = clampNum(lv.mix, 0, 0.85);
      const d = clampNum(lv.decaySec, 0.5, 5.5);
      const pd = clampNum(lv.preDelayMs, 0, 100);
      const sh = clampNum(lv.shimmer, 0, 1);
      if (m !== undefined) lv.mix = m;
      if (d !== undefined) lv.decaySec = d;
      if (pd !== undefined) lv.preDelayMs = pd;
      if (sh !== undefined) lv.shimmer = sh;
    }
    if (typeof out.harmonicExciter === 'object' && out.harmonicExciter) {
      const he = out.harmonicExciter as Record<string, unknown>;
      const th = clampNum(he.tuneHz, 1500, 8000);
      const ha = clampNum(he.harmonics, 0, 1);
      const sp = clampNum(he.subPunch, 0, 1);
      const ag = clampNum(he.airGainDb, 0, 10);
      if (th !== undefined) he.tuneHz = th;
      if (ha !== undefined) he.harmonics = ha;
      if (sp !== undefined) he.subPunch = sp;
      if (ag !== undefined) he.airGainDb = ag;
    }
    if (typeof out.stereoImager === 'object' && out.stereoImager) {
      const si = out.stereoImager as Record<string, unknown>;
      const w = clampNum(si.width, 0, 2);
      const lm = clampNum(si.lowMonoHz, 40, 240);
      const mg = clampNum(si.midGainDb, -6, 6);
      const sg = clampNum(si.sideGainDb, -6, 6);
      if (w !== undefined) si.width = w;
      if (lm !== undefined) si.lowMonoHz = lm;
      if (mg !== undefined) si.midGainDb = mg;
      if (sg !== undefined) si.sideGainDb = sg;
    }
    if (typeof out.luxuryMaster === 'object' && out.luxuryMaster) {
      const lm = out.luxuryMaster as Record<string, unknown>;
      const cd = clampNum(lm.ceilingDb, -3, 0);
      const ag = clampNum(lm.analogGlow, 0, 1);
      if (cd !== undefined) lm.ceilingDb = cd;
      if (ag !== undefined) lm.analogGlow = ag;
    }
    if (typeof out.sovereignChain === 'object' && out.sovereignChain) {
      const sc = out.sovereignChain as Record<string, unknown>;
      if (typeof sc.subGen === 'object' && sc.subGen) {
        const sg = sc.subGen as Record<string, unknown>;
        const fh = clampNum(sg.freqHz, 35, 90);
        const dr = clampNum(sg.drive, 0, 1);
        if (fh !== undefined) sg.freqHz = fh;
        if (dr !== undefined) sg.drive = dr;
      }
      if (typeof sc.transient === 'object' && sc.transient) {
        const tr = sc.transient as Record<string, unknown>;
        const ad = clampNum(tr.attackDb, -6, 6);
        const su = clampNum(tr.sustainPct, 50, 150);
        if (ad !== undefined) tr.attackDb = ad;
        if (su !== undefined) tr.sustainPct = su;
      }
      if (typeof sc.vcaComp === 'object' && sc.vcaComp) {
        const vc = sc.vcaComp as Record<string, unknown>;
        const th = clampNum(vc.threshold, -30, 0);
        const ra = clampNum(vc.ratio, 2, 10);
        const rl = clampNum(vc.releaseMs, 50, 1000);
        const mg = clampNum(vc.makeupGain, 0.5, 2.0);
        if (th !== undefined) vc.threshold = th;
        if (ra !== undefined) vc.ratio = ra;
        if (rl !== undefined) vc.releaseMs = rl;
        if (mg !== undefined) vc.makeupGain = mg;
      }
      if (typeof sc.limiter === 'object' && sc.limiter) {
        const li = sc.limiter as Record<string, unknown>;
        const td = clampNum(li.thresholdDb, -12, 0);
        const cd = clampNum(li.ceilingDb, -3, 0);
        if (td !== undefined) li.thresholdDb = td;
        if (cd !== undefined) li.ceilingDb = cd;
      }
    }
    return out;
  };

  const handleAiSoundEngineer = async (req: express.Request, res: express.Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured. Configure it in Settings > Secrets to use the AI Sound Engineer.',
      });
      return;
    }

    try {
      const { directive, currentParams, cables, telemetry, librarySummary, history } = req.body ?? {};
      if (!directive || typeof directive !== 'string') {
        res.status(400).json({ error: 'Missing sound engineering prompt.' });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction =
        'You are the Chief AI Sound Engineer & Systems Architect inside AIM Studio (SSL 9000G Console + Tri-Cabinet 3D Analog Mastering Racks + Sovereign DnD DSP Chain + 100 Event Daemons). ' +
        'Your job is to take any user sonic goal or mixing/mastering prompt and sculpt the sound using EVERY relevant element in the entire system simultaneously: ' +
        '1) CABINET I (Analog Sculpting): MP3-01 Input Player (player: inputTrim, loop), AMP-02 Class-A Tube Stage (amp: power, drive, bias, outputGain, hpfEnabled), ' +
        'CMP-03 Hyper-Gap Compressor & 12-slider matrix (compressor: power, hyperEnabled, threshold, ratio, attack, release, makeupGain, preset ["bass"|"vocal"|"quiet"], beatSensitivity, autoBeatShockwaves, s1Floor/s1Condense/s1Round, s2Floor/s2Condense/s2Round, s3Floor/s3Condense/s3Round, s4Density/s4WaveHz/s4SpliceRound), ' +
        'EQ-04 4-Band Mastering EQ (eq: power, lowGain [60Hz], lowMidGain [350Hz], highMidGain [2.4kHz], highGain [10kHz], presenceQ), EXP-05 Output & WAV Exporter (exporter: format ["128k_8khz_16bit"|"128k_16khz_8bit"|"studio_44k_16bit"], normalize, dither, masterVolume). ' +
        '2) CABINET II (Negative Cancellation & True-0dB Silence Mastering): INV-06 Phase Null (phaseNull), SPC-07 4-Band Acoustic Space Matrix (acousticSpace: power, roomWidth, plus individual spatial panning/Haas depth/negative gain for low <180Hz, lowMid 180-900Hz, highMid 900-4200Hz, high >4200Hz), ' +
        'REV-08 Reversed-Frequency Silence Amp (revAmp), NCL-09 Negative Compressor/Limiter/Gate (negMaster), ZDB-10 True-0dB Summation Bus (zeroDbBus: power, trueZeroLock, phaseCoherence, busTrim). ' +
        '3) CABINET III (Luxury Mastering): TAP-11 Analog Tape (tapeSat: power, warmth, saturation, wowFlutter, ips30), LUX-12 Ambient Luxury Hall Reverb (luxuryVerb: power, mix, decaySec, preDelayMs, shimmer, stereoSpread), ' +
        'EXC-13 Harmonic Exciter (harmonicExciter: power, tuneHz, harmonics, subPunch, airGainDb, tubeOddEven), IMG-14 Mid/Side Stereo Imager (stereoImager: power, width, lowMonoHz, midGainDb, sideGainDb, msSolo), FIN-15 Champagne Reference Stage (luxuryMaster: power, ceilingDb, analogGlow, dimSwitch, monoCheck). ' +
        '4) SOVEREIGN DND MASTERING CHAIN & SSL VCA BUS: masterPower (keep true unless user asks to mute/power off), sovereignChain.order (exact permutation of ["subGen","tapeSat","exciter","transient","vcaComp","reverb","limiter","fft","recorder"]), ' +
        'sovereignChain.bypass (per-unit boolean), sovereignChain.subGen (freqHz 35..90, drive 0..1), sovereignChain.transient (attackDb -6..6, sustainPct 50..150), sovereignChain.vcaComp (threshold -30..0, ratio 2..10, releaseMs 50..1000, makeupGain 0.5..2.0), sovereignChain.limiter (thresholdDb -12..0, ceilingDb -3..0). ' +
        '5) TRI-CABINET PATCHBAY CABLES: Optional acyclic cable routing array {from, to}. Valid outputs: player_out, amp_out, cmp_out, eq_out, null_out, spc_out, rev_out, ncl_out, zdb_out, tap_out, lux_out, exc_out, img_out, fin_out. Valid inputs: amp_in, cmp_in, eq_in, null_in, spc_in, rev_in, ncl_in, zdb_in, tap_in, lux_in, exc_in, img_in, fin_in, exp_in. Always start from player_out and terminate cleanly into exp_in with NO cycles and NO duplicate inputs. ' +
        '6) DAEMON NETWORK & STUDIO ARCHITECTURE: daemonAutomation (automationEnabled, autoGainGuard) and studioView (xRayWalls, abstractRacks, showFractal) when architectural inspection helps. ' +
        'Think like a Grammy-winning analog mastering engineer: calibrate cohesive, musical values across ALL relevant modules simultaneously to achieve the user goal without clipping, list every modified element in appliedElements, explain the signal chain in signalChainRationale, and give a concise 1-2 sentence summary.';

      const promptPayload = JSON.stringify({
        userGoalPrompt: directive,
        recentEngineeringHistory: Array.isArray(history) ? history.slice(-6) : [],
        currentParams,
        currentCables: cables,
        liveTelemetry: telemetry,
        librarySummary,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptPayload,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'Concise 1-2 sentence engineering summary of how the entire system was sculpted to reach the sonic goal.',
              },
              presetName: {
                type: Type.STRING,
                description: 'Short mix/mastering title (2-5 words).',
              },
              signalChainRationale: {
                type: Type.STRING,
                description: '1-2 sentence technical rationale explaining the signal path from Cabinet I through II/III and the Sovereign SSL VCA chain.',
              },
              appliedElements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of studio module codes and subsystems modified (e.g. "AMP-02", "CMP-03", "EQ-04", "SPC-07 4-Band", "TAP-11", "IMG-14", "SSL-VCA", "Patchbay").',
              },
              masterPower: { type: Type.BOOLEAN },
              player: {
                type: Type.OBJECT,
                properties: {
                  inputTrim: { type: Type.NUMBER, description: '0.2 to 2.0' },
                  loop: { type: Type.BOOLEAN },
                },
              },
              amp: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  drive: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  bias: { type: Type.NUMBER, description: '-0.5 to 0.5' },
                  outputGain: { type: Type.NUMBER, description: '0.2 to 2.0' },
                  hpfEnabled: { type: Type.BOOLEAN },
                },
              },
              compressor: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  hyperEnabled: { type: Type.BOOLEAN },
                  threshold: { type: Type.NUMBER, description: '-48 to 0 dB' },
                  ratio: { type: Type.NUMBER, description: '1 to 20' },
                  attack: { type: Type.NUMBER, description: '0.001 to 0.25 s' },
                  release: { type: Type.NUMBER, description: '0.04 to 1.0 s' },
                  makeupGain: { type: Type.NUMBER, description: '0.5 to 2.5' },
                  preset: { type: Type.STRING, description: 'bass | vocal | quiet' },
                  beatSensitivity: { type: Type.NUMBER, description: '1.05 to 2.5' },
                  autoBeatShockwaves: { type: Type.BOOLEAN },
                  gapCondense: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  waveRound: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  silenceFloor: { type: Type.NUMBER, description: '0.005 to 0.25' },
                  dynamicDensity: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  waveFreqHz: { type: Type.NUMBER, description: '1.0 to 24.0' },
                  s1Floor: { type: Type.NUMBER },
                  s1Condense: { type: Type.NUMBER },
                  s1Round: { type: Type.NUMBER },
                  s2Floor: { type: Type.NUMBER },
                  s2Condense: { type: Type.NUMBER },
                  s2Round: { type: Type.NUMBER },
                  s3Floor: { type: Type.NUMBER },
                  s3Condense: { type: Type.NUMBER },
                  s3Round: { type: Type.NUMBER },
                  s4Density: { type: Type.NUMBER },
                  s4WaveHz: { type: Type.NUMBER },
                  s4SpliceRound: { type: Type.NUMBER },
                },
              },
              eq: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  lowGain: { type: Type.NUMBER, description: '-12 to 12 dB (60Hz)' },
                  lowMidGain: { type: Type.NUMBER, description: '-12 to 12 dB (350Hz)' },
                  highMidGain: { type: Type.NUMBER, description: '-12 to 12 dB (2.4kHz)' },
                  highGain: { type: Type.NUMBER, description: '-12 to 12 dB (10kHz)' },
                  presenceQ: { type: Type.NUMBER, description: '0.4 to 4.0' },
                },
              },
              exporter: {
                type: Type.OBJECT,
                properties: {
                  format: { type: Type.STRING, description: '128k_8khz_16bit | 128k_16khz_8bit | studio_44k_16bit' },
                  normalize: { type: Type.BOOLEAN },
                  dither: { type: Type.BOOLEAN },
                  masterVolume: { type: Type.NUMBER, description: '0.0 to 1.5' },
                },
              },
              phaseNull: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  polarityInvert: { type: Type.BOOLEAN },
                  cancelDepth: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  nullFloor: { type: Type.NUMBER, description: '0.002 to 0.25' },
                  zeroDbFocus: { type: Type.NUMBER, description: '0.0 to 1.0' },
                },
              },
              acousticSpace: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  roomWidth: { type: Type.NUMBER, description: '0.0 to 1.5' },
                  low: bandSpaceSchema,
                  lowMid: bandSpaceSchema,
                  highMid: bandSpaceSchema,
                  high: bandSpaceSchema,
                },
              },
              revAmp: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  reverseFreq: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  negAmpGainDb: { type: Type.NUMBER, description: '0.0 to 24.0' },
                  mirrorPivotHz: { type: Type.NUMBER, description: '200 to 6000' },
                  trueZeroClamp: { type: Type.BOOLEAN },
                },
              },
              negMaster: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  gateInvert: { type: Type.BOOLEAN },
                  negThreshold: { type: Type.NUMBER, description: '-60 to -3 dB' },
                  invRatio: { type: Type.NUMBER, description: '1.0 to 20.0' },
                  silenceLift: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  gateFloorDb: { type: Type.NUMBER, description: '-72 to -12 dB' },
                  limiterCeilingDb: { type: Type.NUMBER, description: '-3.0 to 0.0 dB' },
                },
              },
              zeroDbBus: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  trueZeroLock: { type: Type.BOOLEAN },
                  phaseCoherence: { type: Type.NUMBER, description: '-1.0 to 1.0' },
                  busTrim: { type: Type.NUMBER, description: '0.2 to 1.5' },
                },
              },
              tapeSat: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  warmth: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  saturation: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  wowFlutter: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  ips30: { type: Type.BOOLEAN },
                },
              },
              luxuryVerb: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  mix: { type: Type.NUMBER, description: '0.0 to 0.85' },
                  decaySec: { type: Type.NUMBER, description: '0.5 to 5.5 s' },
                  preDelayMs: { type: Type.NUMBER, description: '0 to 100 ms' },
                  shimmer: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  stereoSpread: { type: Type.BOOLEAN },
                },
              },
              harmonicExciter: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  tuneHz: { type: Type.NUMBER, description: '1500 to 8000 Hz' },
                  harmonics: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  subPunch: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  airGainDb: { type: Type.NUMBER, description: '0.0 to 10.0 dB' },
                  tubeOddEven: { type: Type.BOOLEAN },
                },
              },
              stereoImager: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  width: { type: Type.NUMBER, description: '0.0 to 2.0' },
                  lowMonoHz: { type: Type.NUMBER, description: '40 to 240 Hz' },
                  midGainDb: { type: Type.NUMBER, description: '-6.0 to +6.0 dB' },
                  sideGainDb: { type: Type.NUMBER, description: '-6.0 to +6.0 dB' },
                  msSolo: { type: Type.BOOLEAN },
                },
              },
              luxuryMaster: {
                type: Type.OBJECT,
                properties: {
                  power: { type: Type.BOOLEAN },
                  ceilingDb: { type: Type.NUMBER, description: '-3.0 to 0.0 dB' },
                  analogGlow: { type: Type.NUMBER, description: '0.0 to 1.0' },
                  dimSwitch: { type: Type.BOOLEAN },
                  monoCheck: { type: Type.BOOLEAN },
                },
              },
              sovereignChain: {
                type: Type.OBJECT,
                properties: {
                  order: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Permutation of subGen, tapeSat, exciter, transient, vcaComp, reverb, limiter, fft, recorder',
                  },
                  bypass: {
                    type: Type.OBJECT,
                    properties: {
                      subGen: { type: Type.BOOLEAN },
                      tapeSat: { type: Type.BOOLEAN },
                      exciter: { type: Type.BOOLEAN },
                      transient: { type: Type.BOOLEAN },
                      vcaComp: { type: Type.BOOLEAN },
                      reverb: { type: Type.BOOLEAN },
                      limiter: { type: Type.BOOLEAN },
                      fft: { type: Type.BOOLEAN },
                      recorder: { type: Type.BOOLEAN },
                    },
                  },
                  subGen: {
                    type: Type.OBJECT,
                    properties: {
                      freqHz: { type: Type.NUMBER, description: '35 to 90 Hz' },
                      drive: { type: Type.NUMBER, description: '0.0 to 1.0' },
                    },
                  },
                  transient: {
                    type: Type.OBJECT,
                    properties: {
                      attackDb: { type: Type.NUMBER, description: '-6.0 to +6.0 dB' },
                      sustainPct: { type: Type.NUMBER, description: '50 to 150 %' },
                    },
                  },
                  vcaComp: {
                    type: Type.OBJECT,
                    properties: {
                      threshold: { type: Type.NUMBER, description: '-30 to 0 dB' },
                      ratio: { type: Type.NUMBER, description: '2 to 10' },
                      releaseMs: { type: Type.NUMBER, description: '50 to 1000 ms' },
                      makeupGain: { type: Type.NUMBER, description: '0.5 to 2.0' },
                    },
                  },
                  limiter: {
                    type: Type.OBJECT,
                    properties: {
                      thresholdDb: { type: Type.NUMBER, description: '-12 to 0 dB' },
                      ceilingDb: { type: Type.NUMBER, description: '-3 to 0 dB' },
                    },
                  },
                },
              },
              daemonAutomation: {
                type: Type.OBJECT,
                properties: {
                  automationEnabled: { type: Type.BOOLEAN },
                  autoGainGuard: { type: Type.BOOLEAN },
                },
              },
              studioView: {
                type: Type.OBJECT,
                properties: {
                  xRayWalls: { type: Type.BOOLEAN },
                  abstractRacks: { type: Type.BOOLEAN },
                  showFractal: { type: Type.BOOLEAN },
                },
              },
              daemonMode: {
                type: Type.STRING,
                description: 'Automation profile name for the 100 event daemons.',
              },
              cables: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    from: { type: Type.STRING },
                    to: { type: Type.STRING },
                  },
                },
              },
            },
            required: ['summary', 'presetName', 'appliedElements'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      res.json(sanitizeAiPlan(parsed));
    } catch (err: unknown) {
      const status =
        typeof (err as { status?: number })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      const message = err instanceof Error ? err.message : 'AI Sound Engineer request failed.';
      console.error('AI Sound Engineer error:', err);
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  };

  app.post('/api/ai/orchestrate', handleAiSoundEngineer);
  app.post('/api/ai/sound-engineer', handleAiSoundEngineer);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: disableHmr ? false : { server: httpServer },
        hmr: disableHmr ? false : true,
      },
      appType: 'spa',
    });
    if (disableHmr) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const result = await vite.transformRequest('/@vite/client');
          if (!result) return next();
          const patched = result.code.replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR disabled via DISABLE_HMR=true */'
          );
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Cache-Control', 'no-cache');
          res.send(patched);
        } catch (err) {
          next(err);
        }
      });
    }
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Monolith Noir Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
