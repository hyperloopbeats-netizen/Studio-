import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiEngineerHistoryEntry,
  AiEngineerPassRecord,
  AudioTelemetry,
  InputJackId,
  JackId,
  MainAiDirectiveResponse,
  NarrationInjectionStep,
  OutputJackId,
  PatchCable,
  RackModuleId,
  RackParameters,
  SelectedControlInfo,
  SensitivityPresetKey,
  SovereignUnitId,
  StudioJsonLibrary,
  WavExportFormat,
} from './types/studio';
import {
  DEFAULT_CABLES,
  DEFAULT_RACK_PARAMETERS,
  DragonflySwarm,
} from './engine/dragonflySwarm';
import { DaemonNetwork } from './engine/daemonNetwork';
import { SENSITIVITY_PRESETS, StudioAudioEngine } from './engine/audioEngine';
import { SelfNarrationInjector } from './engine/selfNarrationInjector';
import {
  createStudioLibraryInDrive,
  deleteStudioLibraryInDrive,
  findStudioLibraryFiles,
  readStudioLibraryFromDrive,
  updateStudioLibraryInDrive,
} from './engine/driveLibrarySync';
import { getAccessToken, googleSignIn, initAuth, logout } from './lib/firebaseAuth';
import { CameraPreset, StudioRack3D } from './components/StudioRack3D';
import { StudioDock } from './components/StudioDock';
import { OrchestratorDrawer } from './components/OrchestratorDrawer';
import { DriveConfirmModal } from './components/DriveConfirmModal';

const INITIAL_TELEMETRY: AudioTelemetry = {
  bass: 0,
  mid: 0,
  treble: 0,
  rms: 0,
  peak: 0,
  isSilentGap: true,
  gapCondensePct: 0,
  waveRoundVal: 0,
  sonicSegmentCount: 0,
  beatCount: 0,
  beatEnergy: 0,
  effectiveThreshold: 0.15,
  isBeatTriggered: false,
  freqBins: new Array(32).fill(0),
  envTrace: new Array(64).fill(0),
  cableEnergy: {},
  moduleLevels: {
    player: 0,
    amp: 0,
    compressor: 0,
    eq: 0,
    exporter: 0,
    phaseNull: 0,
    acousticSpace: 0,
    revAmp: 0,
    negMaster: 0,
    zeroDbBus: 0,
    tapeSat: 0,
    luxuryVerb: 0,
    harmonicExciter: 0,
    stereoImager: 0,
    luxuryMaster: 0,
  },
  hasActiveAudio: false,
  silenceAmpDb: -72,
  trueZeroProximity: 0,
  negLiftDb: 0,
  bandSpaceLevels: [0, 0, 0, 0],
  tapeSaturationPct: 0,
  luxRoomLevel: 0,
  stereoCorrelation: 1,
  sslVcaGrDb: 0,
};

function isOutputJack(jack: JackId): jack is OutputJackId {
  return jack.endsWith('_out');
}

export default function App() {
  const swarm = useMemo(() => new DragonflySwarm(), []);
  const daemonBus = useMemo(() => new DaemonNetwork(), []);
  const audioEngine = useMemo(() => new StudioAudioEngine(), []);
  const injector = useMemo(() => new SelfNarrationInjector(), []);

  const [library, setLibrary] = useState<StudioJsonLibrary>(() => swarm.getLibrary());
  const [params, setParams] = useState<RackParameters>(() =>
    JSON.parse(JSON.stringify(DEFAULT_RACK_PARAMETERS))
  );
  const [cables, setCables] = useState<PatchCable[]>(() =>
    DEFAULT_CABLES.map((c) => ({ ...c }))
  );

  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('three_quarter');
  const [cameraPresetNonce, setCameraPresetNonce] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [xRayWalls, setXRayWalls] = useState(false);
  const [abstractRacks, setAbstractRacks] = useState(false);
  const [showFractal, setShowFractal] = useState(true);
  const [isBackView, setIsBackView] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedControl, setSelectedControl] = useState<SelectedControlInfo | null>(null);
  const [pendingJack, setPendingJack] = useState<OutputJackId | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [webmSummary, setWebmSummary] = useState<string | null>(null);
  const [narrationSteps, setNarrationSteps] = useState<NarrationInjectionStep[]>(() =>
    injector.getSteps()
  );
  const injectionTimersRef = useRef<number[]>([]);

  const [sourceStatus, setSourceStatus] = useState(() => audioEngine.getSourceStatus());
  const [playbackProgress, setPlaybackProgress] = useState({ currentSec: 0, durationSec: 0 });
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportSummary, setLastExportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Daemon UI Snapshot
  const [, setDaemonTick] = useState(0);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [autoGainGuard, setAutoGainGuard] = useState(true);

  // Google Drive Auth & Sync State
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveStatus, setDriveStatus] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    action: (() => Promise<void>) | null;
  }>({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    action: null,
  });

  // Main AI Sound Engineer State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPassHistory, setAiPassHistory] = useState<AiEngineerPassRecord[]>([]);
  const [canUndoAiPass, setCanUndoAiPass] = useState(false);
  const aiUndoSnapshotRef = useRef<{
    params: RackParameters;
    cables: PatchCable[];
    automationEnabled: boolean;
    autoGainGuard: boolean;
    xRayWalls: boolean;
    abstractRacks: boolean;
    showFractal: boolean;
  } | null>(null);

  const telemetryRef = useRef<AudioTelemetry>(INITIAL_TELEMETRY);
  const noticeTimerRef = useRef<number | null>(null);
  const lastGuardTrimRef = useRef<number>(0);

  const notify = useCallback((msg: string) => {
    setStatusNotice(msg);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      setStatusNotice(null);
    }, 3400);
  }, []);

  // Subscribe to Daemon Bus updates
  useEffect(() => {
    const unsub = daemonBus.subscribe(() => {
      setDaemonTick((n) => n + 1);
    });
    daemonBus.emit(
      'library:read',
      'DragonflySwarm',
      `100 Dragonfly Architects indexed ${library.presets.length} rack presets (${library.checksum}).`
    );
    return unsub;
  }, [daemonBus, library.checksum, library.presets.length]);

  // Wire audio engine callbacks to Daemon Bus
  useEffect(() => {
    audioEngine.setCallbacks({
      onBeat: () => {
        daemonBus.emit(
          'audio:transient',
          'CMP-03',
          'Transient beat locked across patchbay bus.'
        );
      },
      onSilenceGap: (isGap) => {
        if (isGap) {
          daemonBus.emit(
            'audio:silence_gap',
            'CMP-03',
            'Silence gap condensed with sinusoidal wave rounding.'
          );
        }
      },
    });
  }, [audioEngine, daemonBus]);

  // Sync params & cables to Audio Engine
  useEffect(() => {
    audioEngine.applyParameters(params);
  }, [audioEngine, params]);

  useEffect(() => {
    audioEngine.rewirePatchbay(cables);
  }, [audioEngine, cables]);

  // Unlock suspended AudioContext cleanly on any user pointer/key gesture
  useEffect(() => {
    const unlock = () => audioEngine.unlockOnGesture();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [audioEngine]);

  // Global [Tab] key flips Front/Back view across Dock cabling & 3D rear camera
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      setIsBackView((prev) => {
        const next = !prev;
        setCameraPreset(next ? 'rear' : 'front');
        setCameraPresetNonce((n) => n + 1);
        return next;
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Keep Self-Narration injection script telemetry aligned with live state
  useEffect(() => {
    setNarrationSteps(injector.evaluateAgainstState(params, xRayWalls));
  }, [injector, params, xRayWalls]);

  useEffect(() => {
    return () => {
      for (const t of injectionTimersRef.current) window.clearTimeout(t);
      injectionTimersRef.current = [];
    };
  }, []);

  // High-frequency telemetry sampling loop + Daemon Auto-Gain Guard
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const telem = audioEngine.sampleTelemetry((now - t0) * 0.001);
      telemetryRef.current = telem;

      if (
        daemonBus.isAutomationEnabled() &&
        daemonBus.isAutoGainGuardEnabled() &&
        telem.peak > 0.96 &&
        now - lastGuardTrimRef.current > 1200
      ) {
        lastGuardTrimRef.current = now;
        setParams((prev) => {
          if (prev.exporter.masterVolume <= 0.45) return prev;
          const nextVol = Number((prev.exporter.masterVolume - 0.05).toFixed(2));
          return {
            ...prev,
            exporter: { ...prev.exporter, masterVolume: nextVol },
          };
        });
        daemonBus.emit(
          'rack:dial_turn',
          'GainGuardDaemon',
          'Auto-Gain Guard trimmed Master Volume by -0.05 to preserve headroom.'
        );
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audioEngine.dispose();
    };
  }, [audioEngine, daemonBus]);

  // Periodic MP3 track timecode & status sync (4Hz)
  useEffect(() => {
    const id = window.setInterval(() => {
      setPlaybackProgress(audioEngine.getPlaybackProgress());
      setSourceStatus(audioEngine.getSourceStatus());
    }, 250);
    return () => window.clearInterval(id);
  }, [audioEngine]);

  // Firebase Auth listener for Google Drive
  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        setIsSignedIn(true);
        setUserEmail(user.email || user.displayName || 'Google User');
      },
      () => {
        setIsSignedIn(false);
        setUserEmail(null);
      }
    );
    return () => unsub();
  }, []);

  const refreshSourceStatus = useCallback(() => {
    setSourceStatus(audioEngine.getSourceStatus());
    setPlaybackProgress(audioEngine.getPlaybackProgress());
  }, [audioEngine]);

  // Update individual dial / switch parameter
  const handleUpdateParam = useCallback(
    (moduleId: RackModuleId, controlId: string, value: number | boolean | string) => {
      setParams((prev) => {
        const next: RackParameters = JSON.parse(JSON.stringify(prev));
        if (moduleId === 'player') {
          if (controlId === 'inputTrim' && typeof value === 'number') {
            next.player.inputTrim = value;
          } else if (controlId === 'loop' && typeof value === 'boolean') {
            next.player.loop = value;
          }
        } else if (moduleId === 'amp') {
          if (controlId === 'power' && typeof value === 'boolean') next.amp.power = value;
          if (controlId === 'hpfEnabled' && typeof value === 'boolean') next.amp.hpfEnabled = value;
          if (controlId === 'drive' && typeof value === 'number') next.amp.drive = value;
          if (controlId === 'bias' && typeof value === 'number') next.amp.bias = value;
          if (controlId === 'outputGain' && typeof value === 'number') next.amp.outputGain = value;
        } else if (moduleId === 'compressor') {
          if (controlId === 'power' && typeof value === 'boolean') next.compressor.power = value;
          if (controlId === 'hyperEnabled' && typeof value === 'boolean') {
            next.compressor.hyperEnabled = value;
          }
          if (controlId === 'autoBeatShockwaves' && typeof value === 'boolean') {
            next.compressor.autoBeatShockwaves = value;
          }
          if (controlId === 'threshold' && typeof value === 'number') next.compressor.threshold = value;
          if (controlId === 'ratio' && typeof value === 'number') next.compressor.ratio = value;
          if (controlId === 'attack' && typeof value === 'number') next.compressor.attack = value;
          if (controlId === 'release' && typeof value === 'number') next.compressor.release = value;
          if (controlId === 'makeupGain' && typeof value === 'number') {
            next.compressor.makeupGain = value;
          }
          if (controlId === 'gapCondenseMaster' && typeof value === 'number') {
            next.compressor.s1Condense = value;
            next.compressor.s2Condense = value;
            next.compressor.s3Condense = value;
          }
          if (controlId === 'waveRoundMaster' && typeof value === 'number') {
            next.compressor.s1Round = value;
            next.compressor.s2Round = value;
            next.compressor.s3Round = value;
            next.compressor.s4SpliceRound = value;
          }
          const matrixKeys = new Set([
            's1Floor',
            's1Condense',
            's1Round',
            's2Floor',
            's2Condense',
            's2Round',
            's3Floor',
            's3Condense',
            's3Round',
            's4Density',
            's4WaveHz',
            's4SpliceRound',
          ]);
          if (matrixKeys.has(controlId) && typeof value === 'number') {
            (next.compressor as unknown as Record<string, number>)[controlId] = value;
          }
        } else if (moduleId === 'eq') {
          if (controlId === 'power' && typeof value === 'boolean') next.eq.power = value;
          if (controlId === 'lowGain' && typeof value === 'number') next.eq.lowGain = value;
          if (controlId === 'lowMidGain' && typeof value === 'number') next.eq.lowMidGain = value;
          if (controlId === 'highMidGain' && typeof value === 'number') next.eq.highMidGain = value;
          if (controlId === 'highGain' && typeof value === 'number') next.eq.highGain = value;
          if (controlId === 'presenceQ' && typeof value === 'number') next.eq.presenceQ = value;
        } else if (moduleId === 'exporter') {
          if (controlId === 'masterVolume' && typeof value === 'number') {
            next.exporter.masterVolume = value;
          } else if (controlId === 'normalize' && typeof value === 'boolean') {
            next.exporter.normalize = value;
          } else if (controlId === 'dither' && typeof value === 'boolean') {
            next.exporter.dither = value;
          } else if (controlId === 'format' && typeof value === 'string') {
            next.exporter.format = value as WavExportFormat;
          }
        } else if (moduleId === 'phaseNull') {
          if (controlId === 'power' && typeof value === 'boolean') next.phaseNull.power = value;
          if (controlId === 'polarityInvert' && typeof value === 'boolean') {
            next.phaseNull.polarityInvert = value;
          }
          if (controlId === 'cancelDepth' && typeof value === 'number') {
            next.phaseNull.cancelDepth = value;
          }
          if (controlId === 'nullFloor' && typeof value === 'number') {
            next.phaseNull.nullFloor = value;
          }
          if (controlId === 'zeroDbFocus' && typeof value === 'number') {
            next.phaseNull.zeroDbFocus = value;
          }
        } else if (moduleId === 'acousticSpace') {
          if (controlId === 'power' && typeof value === 'boolean') next.acousticSpace.power = value;
          if (controlId === 'roomWidth' && typeof value === 'number') {
            next.acousticSpace.roomWidth = value;
          }
          if (controlId.includes('.')) {
            const [bandKey, propKey] = controlId.split('.') as [
              'low' | 'lowMid' | 'highMid' | 'high',
              'enabled' | 'solo' | 'pan' | 'spaceDepth' | 'negGain'
            ];
            const band = next.acousticSpace[bandKey];
            if (band) {
              if ((propKey === 'enabled' || propKey === 'solo') && typeof value === 'boolean') {
                band[propKey] = value;
              } else if (
                (propKey === 'pan' || propKey === 'spaceDepth' || propKey === 'negGain') &&
                typeof value === 'number'
              ) {
                band[propKey] = value;
              }
            }
          }
        } else if (moduleId === 'revAmp') {
          if (controlId === 'power' && typeof value === 'boolean') next.revAmp.power = value;
          if (controlId === 'trueZeroClamp' && typeof value === 'boolean') {
            next.revAmp.trueZeroClamp = value;
          }
          if (controlId === 'reverseFreq' && typeof value === 'number') {
            next.revAmp.reverseFreq = value;
          }
          if (controlId === 'negAmpGainDb' && typeof value === 'number') {
            next.revAmp.negAmpGainDb = value;
          }
          if (controlId === 'mirrorPivotHz' && typeof value === 'number') {
            next.revAmp.mirrorPivotHz = value;
          }
        } else if (moduleId === 'negMaster') {
          if (controlId === 'power' && typeof value === 'boolean') next.negMaster.power = value;
          if (controlId === 'gateInvert' && typeof value === 'boolean') {
            next.negMaster.gateInvert = value;
          }
          if (controlId === 'negThreshold' && typeof value === 'number') {
            next.negMaster.negThreshold = value;
          }
          if (controlId === 'invRatio' && typeof value === 'number') {
            next.negMaster.invRatio = value;
          }
          if (controlId === 'silenceLift' && typeof value === 'number') {
            next.negMaster.silenceLift = value;
          }
          if (controlId === 'gateFloorDb' && typeof value === 'number') {
            next.negMaster.gateFloorDb = value;
          }
          if (controlId === 'limiterCeilingDb' && typeof value === 'number') {
            next.negMaster.limiterCeilingDb = value;
          }
        } else if (moduleId === 'zeroDbBus') {
          if (controlId === 'power' && typeof value === 'boolean') next.zeroDbBus.power = value;
          if (controlId === 'trueZeroLock' && typeof value === 'boolean') {
            next.zeroDbBus.trueZeroLock = value;
          }
          if (controlId === 'phaseCoherence' && typeof value === 'number') {
            next.zeroDbBus.phaseCoherence = value;
          }
          if (controlId === 'busTrim' && typeof value === 'number') {
            next.zeroDbBus.busTrim = value;
          }
        } else if (moduleId === 'tapeSat') {
          if (controlId === 'power' && typeof value === 'boolean') next.tapeSat.power = value;
          if (controlId === 'ips30' && typeof value === 'boolean') next.tapeSat.ips30 = value;
          if (controlId === 'warmth' && typeof value === 'number') next.tapeSat.warmth = value;
          if (controlId === 'saturation' && typeof value === 'number') next.tapeSat.saturation = value;
          if (controlId === 'wowFlutter' && typeof value === 'number') next.tapeSat.wowFlutter = value;
        } else if (moduleId === 'luxuryVerb') {
          if (controlId === 'power' && typeof value === 'boolean') next.luxuryVerb.power = value;
          if (controlId === 'stereoSpread' && typeof value === 'boolean') next.luxuryVerb.stereoSpread = value;
          if (controlId === 'mix' && typeof value === 'number') next.luxuryVerb.mix = value;
          if (controlId === 'decaySec' && typeof value === 'number') next.luxuryVerb.decaySec = value;
          if (controlId === 'preDelayMs' && typeof value === 'number') next.luxuryVerb.preDelayMs = value;
          if (controlId === 'shimmer' && typeof value === 'number') next.luxuryVerb.shimmer = value;
        } else if (moduleId === 'harmonicExciter') {
          if (controlId === 'power' && typeof value === 'boolean') next.harmonicExciter.power = value;
          if (controlId === 'tubeOddEven' && typeof value === 'boolean') next.harmonicExciter.tubeOddEven = value;
          if (controlId === 'tuneHz' && typeof value === 'number') next.harmonicExciter.tuneHz = value;
          if (controlId === 'harmonics' && typeof value === 'number') next.harmonicExciter.harmonics = value;
          if (controlId === 'subPunch' && typeof value === 'number') next.harmonicExciter.subPunch = value;
          if (controlId === 'airGainDb' && typeof value === 'number') next.harmonicExciter.airGainDb = value;
        } else if (moduleId === 'stereoImager') {
          if (controlId === 'power' && typeof value === 'boolean') next.stereoImager.power = value;
          if (controlId === 'msSolo' && typeof value === 'boolean') next.stereoImager.msSolo = value;
          if (controlId === 'width' && typeof value === 'number') next.stereoImager.width = value;
          if (controlId === 'lowMonoHz' && typeof value === 'number') next.stereoImager.lowMonoHz = value;
          if (controlId === 'midGainDb' && typeof value === 'number') next.stereoImager.midGainDb = value;
          if (controlId === 'sideGainDb' && typeof value === 'number') next.stereoImager.sideGainDb = value;
        } else if (moduleId === 'luxuryMaster') {
          if (controlId === 'power' && typeof value === 'boolean') next.luxuryMaster.power = value;
          if (controlId === 'dimSwitch' && typeof value === 'boolean') next.luxuryMaster.dimSwitch = value;
          if (controlId === 'monoCheck' && typeof value === 'boolean') next.luxuryMaster.monoCheck = value;
          if (controlId === 'ceilingDb' && typeof value === 'number') next.luxuryMaster.ceilingDb = value;
          if (controlId === 'analogGlow' && typeof value === 'number') next.luxuryMaster.analogGlow = value;
        }
        return next;
      });

      const evtType = typeof value === 'boolean' ? 'rack:switch_toggle' : 'rack:dial_turn';
      daemonBus.emit(evtType, moduleId.toUpperCase(), `${moduleId}.${controlId} -> ${String(value)}`);
    },
    [daemonBus]
  );

  // Patchbay cable connect / disconnect
  const handleConnectCable = useCallback(
    (from: OutputJackId, to: InputJackId, replaceCableId?: string) => {
      setCables((prev) => {
        const filtered = prev.filter((c) => c.to !== to && c.id !== replaceCableId);
        const tones: PatchCable['tone'][] = [
          'amber',
          'crimson',
          'cobalt',
          'cyan',
          'violet',
          'emerald',
          'magenta',
          'gold',
          'champagne',
          'copper',
        ];
        const candidate: PatchCable = {
          id: `c-${Date.now()}-${Math.floor(Math.random() * 999)}`,
          from,
          to,
          tone: tones[filtered.length % tones.length],
        };
        const proposed = [...filtered, candidate];
        if (audioEngine.wouldCreateCycle(proposed)) {
          notify('Blocked feedback loop: cable cycle not permitted.');
          return prev;
        }
        daemonBus.emit('cable:patch', 'Patchbay', `Connected ${from} -> ${to}`);
        notify(`Patched ${from} -> ${to}`);
        return proposed;
      });
    },
    [audioEngine, daemonBus, notify]
  );

  const handleRemoveCable = useCallback(
    (cableId: string) => {
      setCables((prev) => {
        const target = prev.find((c) => c.id === cableId);
        const next = prev.filter((c) => c.id !== cableId);
        if (target) {
          daemonBus.emit('cable:unpatch', 'Patchbay', `Unplugged ${target.from} -> ${target.to}`);
          notify(`Unplugged ${target.from} -> ${target.to}`);
        }
        return next;
      });
    },
    [daemonBus, notify]
  );

  const handleJackClick = useCallback(
    (jackId: JackId) => {
      if (isOutputJack(jackId)) {
        setPendingJack((prev) => (prev === jackId ? null : jackId));
        notify(`Output ${jackId} armed — click a destination Input jack or drag a cable.`);
        return;
      }

      const targetIn = jackId as InputJackId;
      if (pendingJack) {
        handleConnectCable(pendingJack, targetIn);
        setPendingJack(null);
      } else {
        const existing = cables.find((c) => c.to === targetIn);
        if (existing) {
          handleRemoveCable(existing.id);
        } else {
          notify(`Input ${targetIn} selected — click or drag from an Output jack to patch.`);
        }
      }
    },
    [cables, handleConnectCable, handleRemoveCable, notify, pendingJack]
  );

  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Audio Transport Actions
  const handleUploadFile = useCallback(
    async (file: File) => {
      setFileLoading(true);
      setFileError(null);
      try {
        audioEngine.clearRecordedClip();
        const info = await audioEngine.loadAudioFile(file);
        try {
          await audioEngine.playLoadedFile();
        } catch {
          // If autoplay policy blocked immediate start, file is still loaded and ready for Play
        }
        refreshSourceStatus();
        daemonBus.emit('rack:switch_toggle', 'MP3-01', `Loaded ${info.name}`);
        notify(`Opened ${info.name} (${info.duration.toFixed(1)}s)`);
      } catch (err) {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : `Unable to open "${file.name}". Please choose a valid MP3, WAV, OGG, or M4A file.`;
        setFileError(msg);
        notify(msg);
      } finally {
        setFileLoading(false);
      }
    },
    [audioEngine, daemonBus, notify, refreshSourceStatus]
  );

  const handlePlayPauseFile = useCallback(async () => {
    const st = audioEngine.getSourceStatus();
    if (!st.hasLoadedFile) {
      handleOpenFilePicker();
      return;
    }
    if (st.isFilePlaying) {
      audioEngine.pauseLoadedFile();
    } else {
      await audioEngine.playLoadedFile();
    }
    refreshSourceStatus();
  }, [audioEngine, handleOpenFilePicker, refreshSourceStatus]);

  const handleStopFile = useCallback(() => {
    audioEngine.stopLoadedFile(true);
    refreshSourceStatus();
  }, [audioEngine, refreshSourceStatus]);

  const handleSeekFile = useCallback(
    async (normPos: number) => {
      await audioEngine.seekLoadedFile(normPos);
      refreshSourceStatus();
    },
    [audioEngine, refreshSourceStatus]
  );

  const handleToggleDrone = useCallback(async () => {
    try {
      const active = await audioEngine.toggleDrone();
      refreshSourceStatus();
      notify(active ? '432Hz Harmonic Drone routed into rack.' : '432Hz Drone stopped.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Audio context error.');
    }
  }, [audioEngine, notify, refreshSourceStatus]);

  const handleToggleMic = useCallback(async () => {
    try {
      const active = await audioEngine.toggleMic();
      refreshSourceStatus();
      notify(active ? 'Live microphone routed into MP3-01 input.' : 'Microphone muted.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Microphone permission denied.');
    }
  }, [audioEngine, notify, refreshSourceStatus]);

  const handleToggleBusRecord = useCallback(async () => {
    try {
      const res = await audioEngine.toggleBusRecording();
      refreshSourceStatus();
      if (res.recording) {
        daemonBus.emit('rack:switch_toggle', 'EXP-05', 'Started live Master Bus capture.');
        notify('Recording live Master Bus audio for 128k WAV export...');
      } else {
        daemonBus.emit('export:wav', 'EXP-05', `Captured ${res.capturedSec}s live bus buffer.`);
        notify(`Captured ${res.capturedSec}s live bus audio — click Export 128k WAV.`);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Bus capture error.');
    }
  }, [audioEngine, daemonBus, notify, refreshSourceStatus]);

  const handleExportWav = useCallback(
    async (format: WavExportFormat) => {
      setIsExporting(true);
      try {
        const res = await audioEngine.exportSculptedWav(format);
        const url = URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);

        const summary = `${res.bitrateKbps} kbps · ${res.sampleRate}Hz ${res.bitsPerSample}-bit (${res.durationSec}s)`;
        setLastExportSummary(summary);
        daemonBus.emit('export:wav', 'EXP-05', `Exported ${res.filename} (${summary})`);
        notify(`Exported ${res.filename} (${summary})`);
      } catch (err) {
        notify(err instanceof Error ? err.message : 'WAV export failed.');
      } finally {
        setIsExporting(false);
      }
    },
    [audioEngine, daemonBus, notify]
  );

  const handleToggleBackView = useCallback(() => {
    setIsBackView((prev) => {
      const next = !prev;
      setCameraPreset(next ? 'rear' : 'front');
      setCameraPresetNonce((n) => n + 1);
      notify(next ? 'Flipped to Rear Cabling View [Tab].' : 'Flipped to Front Studio View [Tab].');
      return next;
    });
  }, [notify]);

  const handleToggleMasterPower = useCallback(() => {
    setParams((prev) => {
      const nextPower = !prev.masterPower;
      daemonBus.emit('rack:switch_toggle', 'AIM-PWR', `Master Power -> ${nextPower ? 'ON' : 'OFF'}`);
      notify(`AIM Studio Master Power: ${nextPower ? 'ON' : 'OFF'}`);
      return { ...prev, masterPower: nextPower };
    });
  }, [daemonBus, notify]);

  const handleToggleTestTone = useCallback(async () => {
    try {
      const active = await audioEngine.toggleTestTone();
      refreshSourceStatus();
      daemonBus.emit('rack:switch_toggle', 'OSC-110', active ? '110Hz Saw Tone ON' : '110Hz Saw Tone OFF');
      notify(active ? '110Hz Sawtooth Reference Oscillator active.' : '110Hz Reference Oscillator stopped.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Test oscillator error.');
    }
  }, [audioEngine, daemonBus, notify, refreshSourceStatus]);

  const handleToggleWebmRecord = useCallback(async () => {
    try {
      const res = await audioEngine.toggleWebmRecording();
      refreshSourceStatus();
      if (res.recording) {
        daemonBus.emit('rack:switch_toggle', 'REC-BUS', 'Started live .webm master capture.');
        notify('Recording live AIM Master Bus (.webm)...');
      } else if (res.blob && res.filename) {
        const url = URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
        const info = `Captured ${res.filename} (${res.durationSec ?? 0}s)`;
        setWebmSummary(info);
        daemonBus.emit('export:wav', 'REC-BUS', info);
        notify(info);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'WebM capture error.');
    }
  }, [audioEngine, daemonBus, notify, refreshSourceStatus]);

  const handleReorderSovereignChain = useCallback(
    (nextOrder: SovereignUnitId[]) => {
      setParams((prev) => ({
        ...prev,
        sovereignChain: { ...prev.sovereignChain, order: nextOrder },
      }));
      daemonBus.emit(
        'cable:patch',
        'SovereignDnD',
        `Reordered DSP chain: ${nextOrder.slice(0, 5).join(' -> ')}...`
      );
      notify(`Reordered Sovereign DSP chain (${nextOrder.length} modules).`);
    },
    [daemonBus, notify]
  );

  const handleToggleSovereignBypass = useCallback(
    (unitId: SovereignUnitId) => {
      setParams((prev) => {
        const nextBypass = !prev.sovereignChain.bypass[unitId];
        daemonBus.emit(
          'rack:switch_toggle',
          unitId.toUpperCase(),
          `${unitId} bypass -> ${nextBypass ? 'BYPASSED' : 'ACTIVE'}`
        );
        return {
          ...prev,
          sovereignChain: {
            ...prev.sovereignChain,
            bypass: { ...prev.sovereignChain.bypass, [unitId]: nextBypass },
          },
        };
      });
    },
    [daemonBus]
  );

  const handleUpdateSovereignParam = useCallback(
    (unitId: 'subGen' | 'transient' | 'vcaComp' | 'limiter', key: string, value: number) => {
      setParams((prev) => ({
        ...prev,
        sovereignChain: {
          ...prev.sovereignChain,
          [unitId]: {
            ...prev.sovereignChain[unitId],
            [key]: value,
          },
        },
      }));
      daemonBus.emit('rack:dial_turn', unitId.toUpperCase(), `${unitId}.${key} -> ${value}`);
    },
    [daemonBus]
  );

  const handleReplayNarration = useCallback(() => {
    for (const t of injectionTimersRef.current) window.clearTimeout(t);
    injectionTimersRef.current = [];
    setNarrationSteps(injector.beginSequence());
    notify('Running AIM Studio Self-Narration Code Injection Script...');
    for (let idx = 1; idx <= 5; idx++) {
      const id = window.setTimeout(() => {
        setNarrationSteps(injector.advanceStep(idx));
      }, idx * 420);
      injectionTimersRef.current.push(id);
    }
    const doneId = window.setTimeout(() => {
      injector.completeAll();
      setNarrationSteps(injector.evaluateAgainstState(params, xRayWalls));
      daemonBus.emit('ai:directive', 'SelfNarration', 'Completed 6-phase AIM SSL & Sovereign injection script.');
      notify('Self-Narration Injection Script verified across all 6 phases.');
    }, 6 * 420);
    injectionTimersRef.current.push(doneId);
  }, [daemonBus, injector, notify, params, xRayWalls]);

  const handleTransportAction = useCallback(
    (action: 'open_mp3' | 'play_pause' | 'drone' | 'mic' | 'export_wav') => {
      if (action === 'open_mp3') handleOpenFilePicker();
      else if (action === 'play_pause') handlePlayPauseFile();
      else if (action === 'drone') handleToggleDrone();
      else if (action === 'mic') handleToggleMic();
      else if (action === 'export_wav') handleExportWav(params.exporter.format);
    },
    [
      handleExportWav,
      handleOpenFilePicker,
      handlePlayPauseFile,
      handleToggleDrone,
      handleToggleMic,
      params.exporter.format,
    ]
  );

  const handleApplySensitivityPreset = useCallback(
    (preset: SensitivityPresetKey) => {
      const cfg = SENSITIVITY_PRESETS[preset];
      setParams((prev) => ({
        ...prev,
        compressor: {
          ...prev.compressor,
          preset,
          beatSensitivity: cfg.sensitivity,
        },
      }));
      daemonBus.emit('audio:beat_lock', 'CMP-03', `Applied ${cfg.label} sensitivity profile.`);
      notify(`Sensitivity: ${cfg.label} (${cfg.hint})`);
    },
    [daemonBus, notify]
  );

  // Dragonfly JSON Library Presets
  const handleLoadPreset = useCallback(
    (presetId: string) => {
      const preset = swarm.getPresetFast(presetId);
      if (!preset) return;
      swarm.setActivePresetId(preset.id);
      setLibrary({ ...swarm.getLibrary() });
      setParams(JSON.parse(JSON.stringify(preset.params)));
      setCables(preset.cables.map((c) => ({ ...c })));
      daemonBus.emit('library:read', 'DragonflySwarm', `Loaded preset "${preset.name}" from JSON library.`);
      notify(`Loaded preset: ${preset.name}`);
    },
    [daemonBus, notify, swarm]
  );

  const handleDeletePreset = useCallback(
    (presetId: string) => {
      const updated = swarm.deletePreset(presetId);
      setLibrary({ ...updated });
      daemonBus.emit('library:read', 'DragonflySwarm', `Removed preset ${presetId} from JSON library.`);
      notify('Removed preset from JSON library.');
    },
    [daemonBus, notify, swarm]
  );

  const handleSaveCurrentAsPreset = useCallback(
    (name: string) => {
      const id =
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4);
      const updated = swarm.upsertPreset({
        id,
        name,
        authorSquad: 'Studio User + DF-001..100',
        description: `Custom sculpted analog rack state with ${cables.length} active patch cables.`,
        createdAt: new Date().toISOString(),
        cables: cables.map((c) => ({ ...c })),
        params: JSON.parse(JSON.stringify(params)),
      });
      setLibrary({ ...updated });
      daemonBus.emit('library:read', 'DragonflySwarm', `Saved "${name}" to JSON library.`);
      notify(`Saved "${name}" to Dragonfly JSON library.`);
    },
    [cables, daemonBus, notify, params, swarm]
  );

  const handleRecalibrateSwarm = useCallback(() => {
    const updated = swarm.recalibrateSwarm();
    setLibrary({ ...updated });
    daemonBus.emit(
      'library:read',
      'DragonflySwarm',
      `All 100 Dragonfly Architects recalibrated index (${updated.checksum}) in ${updated.architectManifest.indexLatencyMs} ms.`
    );
    notify(`100 Dragonfly Architects recalibrated (${updated.checksum}).`);
  }, [daemonBus, notify, swarm]);

  // Google Drive Auth & Sync Flows (with mandatory user confirmation before updates or deletes)
  const handleGoogleSignIn = useCallback(async () => {
    try {
      const res = await googleSignIn();
      setIsSignedIn(true);
      setUserEmail(res.user.email || res.user.displayName || 'Google User');
      setDriveStatus('Signed in. Ready to load or sync JSON library.');
      daemonBus.emit('drive:sync', 'GoogleDrive', 'Authenticated with Google Drive.');
    } catch (err) {
      setDriveStatus(err instanceof Error ? err.message : 'Google sign-in cancelled or failed.');
    }
  }, [daemonBus]);

  const handleGoogleLogout = useCallback(async () => {
    await logout();
    setIsSignedIn(false);
    setUserEmail(null);
    setDriveStatus('Signed out.');
  }, []);

  const handleLoadFromDrive = useCallback(async () => {
    if (!getAccessToken()) {
      setDriveStatus('Please sign in with Google first.');
      return;
    }
    setDriveBusy(true);
    setDriveStatus('Searching Google Drive for monolith_studio_library.json...');
    try {
      const files = await findStudioLibraryFiles();
      if (files.length === 0) {
        setDriveStatus('No library file found in Google Drive yet. Use "Sync to Drive" to create it.');
        return;
      }
      const target = files[0];
      const remote = await readStudioLibraryFromDrive(target.id);
      const hydrated = swarm.hydrateFromDrive(remote, target.id);
      setLibrary({ ...hydrated });
      if (hydrated.activePresetId) {
        const active = swarm.getPresetFast(hydrated.activePresetId);
        if (active) {
          setParams(JSON.parse(JSON.stringify(active.params)));
          setCables(active.cables.map((c) => ({ ...c })));
        }
      }
      setDriveStatus(`Loaded ${target.name} from Google Drive (${hydrated.presets.length} presets).`);
      daemonBus.emit('drive:sync', 'GoogleDrive', `Hydrated JSON library from Drive (${target.id}).`);
      notify('Loaded JSON library from Google Drive.');
    } catch (err) {
      setDriveStatus(err instanceof Error ? err.message : 'Failed to load from Google Drive.');
    } finally {
      setDriveBusy(false);
    }
  }, [daemonBus, notify, swarm]);

  const executeDriveSync = useCallback(async () => {
    setDriveBusy(true);
    setDriveStatus('Syncing JSON library to Google Drive...');
    try {
      const existing = await findStudioLibraryFiles();
      const currentLib = swarm.getLibrary();
      if (existing.length > 0) {
        const updated = await updateStudioLibraryInDrive(existing[0].id, currentLib);
        const nextLib = swarm.markDriveSynced(updated.id);
        setLibrary({ ...nextLib });
        setDriveStatus(`Updated ${updated.name} in Google Drive.`);
        daemonBus.emit('drive:sync', 'GoogleDrive', `Updated ${updated.name} on Google Drive.`);
      } else {
        const created = await createStudioLibraryInDrive(currentLib);
        const nextLib = swarm.markDriveSynced(created.id);
        setLibrary({ ...nextLib });
        setDriveStatus(`Created ${created.name} in Google Drive.`);
        daemonBus.emit('drive:sync', 'GoogleDrive', `Created ${created.name} on Google Drive.`);
      }
      notify('JSON Library synced to Google Drive.');
    } catch (err) {
      setDriveStatus(err instanceof Error ? err.message : 'Google Drive sync failed.');
    } finally {
      setDriveBusy(false);
    }
  }, [daemonBus, notify, swarm]);

  const handleSyncToDrive = useCallback(async () => {
    if (!getAccessToken()) {
      setDriveStatus('Please sign in with Google first.');
      return;
    }
    setDriveBusy(true);
    try {
      const existing = await findStudioLibraryFiles();
      setDriveBusy(false);
      if (existing.length > 0) {
        setConfirmModal({
          open: true,
          title: 'Update Google Drive Library File?',
          description: `This will overwrite "${existing[0].name}" in your Google Drive with your current ${library.presets.length} Dragonfly JSON Library presets and checksum ${library.checksum}.`,
          confirmLabel: 'Confirm Update',
          action: executeDriveSync,
        });
      } else {
        await executeDriveSync();
      }
    } catch (err) {
      setDriveBusy(false);
      setDriveStatus(err instanceof Error ? err.message : 'Could not inspect Google Drive files.');
    }
  }, [executeDriveSync, library.checksum, library.presets.length]);

  const handleDeleteFromDrive = useCallback(() => {
    const fileId = library.driveSyncMeta.fileId;
    if (!fileId || !getAccessToken()) return;
    setConfirmModal({
      open: true,
      title: 'Delete Library File from Google Drive?',
      description: `This will permanently delete "${library.driveSyncMeta.fileName}" from your Google Drive. Your local studio session presets will remain intact.`,
      confirmLabel: 'Delete File',
      action: async () => {
        setDriveBusy(true);
        try {
          await deleteStudioLibraryInDrive(fileId);
          const lib = swarm.getLibrary();
          lib.driveSyncMeta = {
            fileId: null,
            fileName: lib.libraryName,
            lastSyncedAt: null,
          };
          setLibrary({ ...lib });
          setDriveStatus('Deleted library file from Google Drive.');
          daemonBus.emit('drive:sync', 'GoogleDrive', 'Deleted library file from Google Drive.');
          notify('Removed JSON library file from Google Drive.');
        } catch (err) {
          setDriveStatus(err instanceof Error ? err.message : 'Failed to delete Drive file.');
        } finally {
          setDriveBusy(false);
        }
      },
    });
  }, [daemonBus, library.driveSyncMeta.fileId, library.driveSyncMeta.fileName, notify, swarm]);

  const handleUndoAiPass = useCallback(() => {
    const snap = aiUndoSnapshotRef.current;
    if (!snap) return;
    setParams(JSON.parse(JSON.stringify(snap.params)));
    setCables(snap.cables.map((c) => ({ ...c })));
    setAutomationEnabled(snap.automationEnabled);
    daemonBus.setAutomationEnabled(snap.automationEnabled);
    setAutoGainGuard(snap.autoGainGuard);
    daemonBus.setAutoGainGuardEnabled(snap.autoGainGuard);
    setXRayWalls(snap.xRayWalls);
    setAbstractRacks(snap.abstractRacks);
    setShowFractal(snap.showFractal);
    aiUndoSnapshotRef.current = null;
    setCanUndoAiPass(false);
    daemonBus.emit('ai:directive', 'AISoundEngineer', 'Reverted studio state to pre-AI snapshot.');
    notify('Reverted to snapshot before last AI Sound Engineer pass.');
  }, [daemonBus, notify]);

  // Chief AI Sound Engineer Handler (sculpts every single element in the system)
  const handleRunAiDirective = useCallback(
    async (directive: string) => {
      setAiLoading(true);
      setAiError(null);
      setAiMessage(null);

      // Save A/B undo snapshot before applying AI calibration
      aiUndoSnapshotRef.current = {
        params: JSON.parse(JSON.stringify(params)),
        cables: cables.map((c) => ({ ...c })),
        automationEnabled,
        autoGainGuard,
        xRayWalls,
        abstractRacks,
        showFractal,
      };

      const historyPayload: AiEngineerHistoryEntry[] = aiPassHistory
        .slice(0, 3)
        .reverse()
        .flatMap((p) => [
          { role: 'user' as const, text: p.prompt },
          { role: 'engineer' as const, text: `${p.presetName}: ${p.summary}` },
        ]);

      try {
        const res = await fetch('/api/ai/sound-engineer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            directive,
            history: historyPayload,
            currentParams: params,
            cables,
            telemetry: {
              bass: telemetryRef.current.bass,
              mid: telemetryRef.current.mid,
              treble: telemetryRef.current.treble,
              rms: telemetryRef.current.rms,
              peak: telemetryRef.current.peak,
              gapCondensePct: telemetryRef.current.gapCondensePct,
              sonicSegmentCount: telemetryRef.current.sonicSegmentCount,
              silenceAmpDb: telemetryRef.current.silenceAmpDb,
              negLiftDb: telemetryRef.current.negLiftDb,
              stereoCorrelation: telemetryRef.current.stereoCorrelation,
              sslVcaGrDb: telemetryRef.current.sslVcaGrDb,
            },
            librarySummary: {
              checksum: library.checksum,
              presetCount: library.presets.length,
              architectCount: library.architectCount,
            },
          }),
        });
        const data = (await res.json()) as MainAiDirectiveResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || `AI Sound Engineer failed (${res.status}).`);
        }

        const touched = new Set<string>(Array.isArray(data.appliedElements) ? data.appliedElements : []);
        const validSovUnits: SovereignUnitId[] = [
          'subGen',
          'tapeSat',
          'exciter',
          'transient',
          'vcaComp',
          'reverb',
          'limiter',
          'fft',
          'recorder',
        ];

        setParams((prev) => {
          const next: RackParameters = JSON.parse(JSON.stringify(prev));
          if (typeof data.masterPower === 'boolean') {
            next.masterPower = data.masterPower;
            touched.add('Master Power');
          }
          if (data.player) {
            if (typeof data.player.inputTrim === 'number') next.player.inputTrim = data.player.inputTrim;
            if (typeof data.player.loop === 'boolean') next.player.loop = data.player.loop;
            touched.add('MP3-01 Player');
          }
          if (data.amp) {
            Object.assign(next.amp, data.amp);
            touched.add('AMP-02 Tube');
          }
          if (data.compressor) {
            const c = data.compressor;
            if (typeof c.power === 'boolean') next.compressor.power = c.power;
            if (typeof c.hyperEnabled === 'boolean') next.compressor.hyperEnabled = c.hyperEnabled;
            if (typeof c.threshold === 'number') next.compressor.threshold = c.threshold;
            if (typeof c.ratio === 'number') next.compressor.ratio = c.ratio;
            if (typeof c.attack === 'number') next.compressor.attack = c.attack;
            if (typeof c.release === 'number') next.compressor.release = c.release;
            if (typeof c.makeupGain === 'number') next.compressor.makeupGain = c.makeupGain;
            if (c.preset === 'bass' || c.preset === 'vocal' || c.preset === 'quiet') {
              next.compressor.preset = c.preset;
            }
            if (typeof c.beatSensitivity === 'number') next.compressor.beatSensitivity = c.beatSensitivity;
            if (typeof c.autoBeatShockwaves === 'boolean') {
              next.compressor.autoBeatShockwaves = c.autoBeatShockwaves;
            }
            if (typeof c.gapCondense === 'number') {
              next.compressor.s1Condense = c.gapCondense;
              next.compressor.s2Condense = c.gapCondense;
              next.compressor.s3Condense = c.gapCondense;
            }
            if (typeof c.waveRound === 'number') {
              next.compressor.s1Round = c.waveRound;
              next.compressor.s2Round = c.waveRound;
              next.compressor.s3Round = c.waveRound;
              next.compressor.s4SpliceRound = c.waveRound;
            }
            if (typeof c.silenceFloor === 'number') {
              next.compressor.s1Floor = c.silenceFloor;
              next.compressor.s2Floor = c.silenceFloor;
              next.compressor.s3Floor = c.silenceFloor;
            }
            if (typeof c.dynamicDensity === 'number') next.compressor.s4Density = c.dynamicDensity;
            if (typeof c.waveFreqHz === 'number') next.compressor.s4WaveHz = c.waveFreqHz;
            // Explicit per-bank Hyper-Gap matrix overrides if provided
            const matrixKeys = [
              's1Floor',
              's1Condense',
              's1Round',
              's2Floor',
              's2Condense',
              's2Round',
              's3Floor',
              's3Condense',
              's3Round',
              's4Density',
              's4WaveHz',
              's4SpliceRound',
            ] as const;
            for (const mk of matrixKeys) {
              const mv = c[mk];
              if (typeof mv === 'number') next.compressor[mk] = mv;
            }
            touched.add('CMP-03 Hyper-Gap');
          }
          if (data.eq) {
            Object.assign(next.eq, data.eq);
            touched.add('EQ-04 Mastering');
          }
          if (data.exporter) {
            if (
              data.exporter.format === '128k_8khz_16bit' ||
              data.exporter.format === '128k_16khz_8bit' ||
              data.exporter.format === 'studio_44k_16bit'
            ) {
              next.exporter.format = data.exporter.format;
            }
            if (typeof data.exporter.normalize === 'boolean') {
              next.exporter.normalize = data.exporter.normalize;
            }
            if (typeof data.exporter.dither === 'boolean') {
              next.exporter.dither = data.exporter.dither;
            }
            if (typeof data.exporter.masterVolume === 'number') {
              next.exporter.masterVolume = data.exporter.masterVolume;
            }
            touched.add('EXP-05 Master Bus');
          }
          if (data.phaseNull) {
            Object.assign(next.phaseNull, data.phaseNull);
            touched.add('INV-06 Phase Null');
          }
          if (data.acousticSpace) {
            if (typeof data.acousticSpace.power === 'boolean') {
              next.acousticSpace.power = data.acousticSpace.power;
            }
            if (typeof data.acousticSpace.roomWidth === 'number') {
              next.acousticSpace.roomWidth = data.acousticSpace.roomWidth;
            }
            for (const bk of ['low', 'lowMid', 'highMid', 'high'] as const) {
              if (data.acousticSpace[bk]) {
                Object.assign(next.acousticSpace[bk], data.acousticSpace[bk]);
              }
            }
            touched.add('SPC-07 4-Band Space');
          }
          if (data.revAmp) {
            Object.assign(next.revAmp, data.revAmp);
            touched.add('REV-08 Silence Amp');
          }
          if (data.negMaster) {
            Object.assign(next.negMaster, data.negMaster);
            touched.add('NCL-09 Neg Master');
          }
          if (data.zeroDbBus) {
            Object.assign(next.zeroDbBus, data.zeroDbBus);
            touched.add('ZDB-10 True-0dB');
          }
          if (data.tapeSat) {
            Object.assign(next.tapeSat, data.tapeSat);
            touched.add('TAP-11 Analog Tape');
          }
          if (data.luxuryVerb) {
            Object.assign(next.luxuryVerb, data.luxuryVerb);
            touched.add('LUX-12 Luxury Hall');
          }
          if (data.harmonicExciter) {
            Object.assign(next.harmonicExciter, data.harmonicExciter);
            touched.add('EXC-13 Exciter');
          }
          if (data.stereoImager) {
            Object.assign(next.stereoImager, data.stereoImager);
            touched.add('IMG-14 M/S Imager');
          }
          if (data.luxuryMaster) {
            Object.assign(next.luxuryMaster, data.luxuryMaster);
            touched.add('FIN-15 Champagne');
          }
          if (data.sovereignChain) {
            const sc = data.sovereignChain;
            if (Array.isArray(sc.order)) {
              const filtered = sc.order.filter((u): u is SovereignUnitId =>
                validSovUnits.includes(u as SovereignUnitId)
              );
              const missing = validSovUnits.filter((u) => !filtered.includes(u));
              const deduped = Array.from(new Set([...filtered, ...missing]));
              if (deduped.length === validSovUnits.length) {
                next.sovereignChain.order = deduped;
              }
            }
            if (sc.bypass) {
              for (const u of validSovUnits) {
                if (typeof sc.bypass[u] === 'boolean') {
                  next.sovereignChain.bypass[u] = Boolean(sc.bypass[u]);
                }
              }
            }
            if (sc.subGen) Object.assign(next.sovereignChain.subGen, sc.subGen);
            if (sc.transient) Object.assign(next.sovereignChain.transient, sc.transient);
            if (sc.vcaComp) Object.assign(next.sovereignChain.vcaComp, sc.vcaComp);
            if (sc.limiter) Object.assign(next.sovereignChain.limiter, sc.limiter);
            touched.add('Sovereign DnD & SSL VCA');
          }
          return next;
        });

        if (data.daemonAutomation) {
          if (typeof data.daemonAutomation.automationEnabled === 'boolean') {
            setAutomationEnabled(data.daemonAutomation.automationEnabled);
            daemonBus.setAutomationEnabled(data.daemonAutomation.automationEnabled);
          }
          if (typeof data.daemonAutomation.autoGainGuard === 'boolean') {
            setAutoGainGuard(data.daemonAutomation.autoGainGuard);
            daemonBus.setAutoGainGuardEnabled(data.daemonAutomation.autoGainGuard);
          }
          touched.add('100 Event Daemons');
        }

        if (data.studioView) {
          if (typeof data.studioView.xRayWalls === 'boolean') setXRayWalls(data.studioView.xRayWalls);
          if (typeof data.studioView.abstractRacks === 'boolean') {
            setAbstractRacks(data.studioView.abstractRacks);
          }
          if (typeof data.studioView.showFractal === 'boolean') {
            setShowFractal(data.studioView.showFractal);
          }
          touched.add('AIM Studio View');
        }

        if (Array.isArray(data.cables) && data.cables.length > 0) {
          const validOut = new Set([
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
          ]);
          const validIn = new Set([
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
          ]);
          const tones: PatchCable['tone'][] = [
            'amber',
            'crimson',
            'cobalt',
            'cyan',
            'violet',
            'emerald',
            'magenta',
            'gold',
            'champagne',
            'copper',
            'platinum',
          ];
          const usedInputs = new Set<string>();
          const nextCables: PatchCable[] = data.cables
            .filter((c) => {
              if (!validOut.has(c.from) || !validIn.has(c.to)) return false;
              if (usedInputs.has(c.to)) return false;
              usedInputs.add(c.to);
              return true;
            })
            .map((c, idx) => ({
              id: `ai-c-${Date.now()}-${idx}`,
              from: c.from,
              to: c.to,
              tone: tones[idx % tones.length],
            }));
          if (nextCables.length > 0 && !audioEngine.wouldCreateCycle(nextCables)) {
            setCables(nextCables);
            touched.add(`Patchbay (${nextCables.length} cables)`);
          }
        }

        const elementsList = Array.from(touched);
        const passRecord: AiEngineerPassRecord = {
          id: `pass-${Date.now()}`,
          prompt: directive,
          presetName: data.presetName,
          summary: data.summary,
          signalChainRationale: data.signalChainRationale,
          appliedElements: elementsList,
          timestamp: Date.now(),
        };
        setAiPassHistory((prev) => [passRecord, ...prev].slice(0, 12));
        setCanUndoAiPass(true);
        setAiMessage(`${data.presetName}: ${data.summary}`);
        daemonBus.emit(
          'ai:directive',
          'AISoundEngineer',
          `Engineered "${data.presetName}" across ${elementsList.length} studio elements.`
        );
        notify(`AI Sound Engineer applied "${data.presetName}" (${elementsList.length} systems).`);
      } catch (err) {
        aiUndoSnapshotRef.current = null;
        setAiError(err instanceof Error ? err.message : 'AI Sound Engineer request failed.');
      } finally {
        setAiLoading(false);
      }
    },
    [
      abstractRacks,
      aiPassHistory,
      audioEngine,
      autoGainGuard,
      automationEnabled,
      cables,
      daemonBus,
      library.architectCount,
      library.checksum,
      library.presets.length,
      notify,
      params,
      showFractal,
      xRayWalls,
    ]
  );

  const daemonStats = daemonBus.getStats();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0d0e12] text-zinc-100">
      {/* Shared Hidden MP3 / Audio File Picker (accessible from both Dock & 3D Open MP3 Pad) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,audio/mpeg,audio/mp3,audio/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUploadFile(f);
          e.currentTarget.value = '';
        }}
      />

      {/* Top Bar (3-zone contract) */}
      <header className="fixed top-0 left-0 right-0 z-30 h-12 px-5 flex items-center justify-between gap-8 bg-[#101217]/95 border-b border-zinc-800/90">
        {/* Zone 1: Brand Title */}
        <span className="text-sm font-bold tracking-wider text-zinc-100 font-cinzel whitespace-nowrap shrink-0">
          AIM Studio
        </span>

        {/* Zone 2: Camera View & Architecture Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
          <button
            type="button"
            onClick={() => {
              setIsBackView(false);
              setCameraPreset('front');
              setCameraPresetNonce((n) => n + 1);
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              cameraPreset === 'front' ? 'text-amber-400 underline underline-offset-4' : ''
            }`}
          >
            Front
          </button>
          <button
            type="button"
            onClick={handleToggleBackView}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              cameraPreset === 'rear' || isBackView
                ? 'text-cyan-400 underline underline-offset-4'
                : ''
            }`}
          >
            Flip [Tab]
          </button>
          <button
            type="button"
            onClick={() => {
              setCameraPreset('ssl_overview');
              setCameraPresetNonce((n) => n + 1);
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              cameraPreset === 'ssl_overview' ? 'text-amber-400 underline underline-offset-4' : ''
            }`}
          >
            SSL &amp; Fractal
          </button>
          <button
            type="button"
            onClick={() => {
              setXRayWalls((v) => !v);
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              xRayWalls ? 'text-cyan-400 underline underline-offset-4' : ''
            }`}
          >
            X-Ray Walls
          </button>
          <button
            type="button"
            onClick={() => setAutoRotate((r) => !r)}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              autoRotate ? 'text-amber-400 underline underline-offset-4' : ''
            }`}
          >
            {autoRotate ? 'Stop Spin' : 'Auto Spin'}
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            {drawerOpen ? 'Close Systems' : 'AI & Systems'}
          </button>
        </div>
      </header>

      {/* Isolated 3D Rack Viewport */}
      <main className="w-full h-full pt-12">
        <StudioRack3D
          params={params}
          cables={cables}
          telemetryRef={telemetryRef}
          cameraPreset={cameraPreset}
          cameraPresetNonce={cameraPresetNonce}
          autoRotate={autoRotate}
          xRayWalls={xRayWalls}
          abstractRacks={abstractRacks}
          showFractal={showFractal}
          pendingJack={pendingJack}
          sourceStatus={sourceStatus}
          onUpdateParam={handleUpdateParam}
          onSelectControl={setSelectedControl}
          onJackClick={handleJackClick}
          onConnectCable={handleConnectCable}
          onRemoveCable={handleRemoveCable}
          onTransportAction={handleTransportAction}
        />
      </main>

      {/* Quiet Hardware Parameter Readout (top-left below header, non-blocking) */}
      <div className="fixed top-14 left-4 z-10 pointer-events-none space-y-1.5">
        {selectedControl && (
          <div className="px-3 py-1.5 bg-[#14161c]/95 border border-zinc-700 rounded-md text-xs font-mono-tabular text-zinc-200">
            <span>{selectedControl.label}</span>
            <span className="text-zinc-500 mx-1.5">·</span>
            <span className="text-amber-400 font-semibold">{selectedControl.formattedValue}</span>
          </div>
        )}
        {pendingJack && (
          <div className="px-3 py-1.5 bg-amber-500 text-zinc-950 rounded-md text-xs font-mono-tabular font-semibold">
            Patching from {pendingJack} — click a Rear Input jack
          </div>
        )}
        {statusNotice && (
          <div className="px-3 py-1.5 bg-[#14161c]/95 border border-zinc-700 rounded-md text-xs text-zinc-200">
            {statusNotice}
          </div>
        )}
      </div>

      {/* Collapsible Bottom Studio Dock */}
      <StudioDock
        params={params}
        cables={cables}
        telemetryRef={telemetryRef}
        sourceStatus={sourceStatus}
        playbackProgress={playbackProgress}
        routingTemplates={library.routingTemplates}
        isExporting={isExporting}
        fileLoading={fileLoading}
        fileError={fileError}
        lastExportSummary={lastExportSummary}
        webmSummary={webmSummary}
        isBackView={isBackView}
        xRayWalls={xRayWalls}
        abstractRacks={abstractRacks}
        showFractal={showFractal}
        onOpenFilePicker={handleOpenFilePicker}
        onUploadFile={handleUploadFile}
        onPlayPauseFile={handlePlayPauseFile}
        onStopFile={handleStopFile}
        onSeekFile={handleSeekFile}
        onToggleDrone={handleToggleDrone}
        onToggleTestTone={handleToggleTestTone}
        onToggleMic={handleToggleMic}
        onToggleBusRecord={handleToggleBusRecord}
        onToggleWebmRecord={handleToggleWebmRecord}
        onToggleMasterPower={handleToggleMasterPower}
        onToggleBackView={handleToggleBackView}
        onToggleXRayWalls={() => setXRayWalls((v) => !v)}
        onToggleAbstractRacks={() => setAbstractRacks((v) => !v)}
        onToggleFractal={() => setShowFractal((v) => !v)}
        onReorderSovereignChain={handleReorderSovereignChain}
        onToggleSovereignBypass={handleToggleSovereignBypass}
        onUpdateSovereignParam={handleUpdateSovereignParam}
        onUpdateParam={handleUpdateParam}
        onApplySensitivityPreset={handleApplySensitivityPreset}
        onApplyRoutingTemplate={(tplCables) => {
          setCables(tplCables.map((c) => ({ ...c })));
          daemonBus.emit(
            'cable:patch',
            'Patchbay',
            `Applied routing template (${tplCables.length} cables).`
          );
          notify(`Applied ${tplCables.length}-cable routing template.`);
        }}
        onConnectCable={handleConnectCable}
        onRemoveCable={handleRemoveCable}
        onExportWav={handleExportWav}
        aiLoading={aiLoading}
        aiMessage={aiMessage}
        aiError={aiError}
        aiPassHistory={aiPassHistory}
        canUndoAiPass={canUndoAiPass}
        onRunAiDirective={handleRunAiDirective}
        onUndoAiPass={handleUndoAiPass}
        onSaveCurrentAsPreset={handleSaveCurrentAsPreset}
      />

      {/* Right Slide-Over Drawer: Main AI + Dragonfly JSON Library + Google Drive + 100 Daemons */}
      <OrchestratorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        library={library}
        architects={swarm.architects}
        daemons={daemonBus.daemons}
        eventLog={daemonBus.getEventLog()}
        daemonStats={daemonStats}
        automationEnabled={automationEnabled}
        autoGainGuard={autoGainGuard}
        onToggleAutomation={(en) => {
          setAutomationEnabled(en);
          daemonBus.setAutomationEnabled(en);
        }}
        onToggleAutoGainGuard={(en) => {
          setAutoGainGuard(en);
          daemonBus.setAutoGainGuardEnabled(en);
        }}
        onLoadPreset={handleLoadPreset}
        onDeletePreset={handleDeletePreset}
        onSaveCurrentAsPreset={handleSaveCurrentAsPreset}
        onRecalibrateSwarm={handleRecalibrateSwarm}
        onRunAiDirective={handleRunAiDirective}
        aiLoading={aiLoading}
        aiMessage={aiMessage}
        aiError={aiError}
        isSignedIn={isSignedIn}
        userEmail={userEmail}
        driveBusy={driveBusy}
        driveStatus={driveStatus}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleLogout={handleGoogleLogout}
        onLoadFromDrive={handleLoadFromDrive}
        onSyncToDrive={handleSyncToDrive}
        onDeleteFromDrive={handleDeleteFromDrive}
        narrationSteps={narrationSteps}
        onReplayNarration={handleReplayNarration}
        telemetryRef={telemetryRef}
        cablesCount={cables.length}
        aiPassHistory={aiPassHistory}
        canUndoAiPass={canUndoAiPass}
        onUndoAiPass={handleUndoAiPass}
      />

      {/* Mandatory Google Drive Mutation Confirmation Dialog */}
      <DriveConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        onCancel={() =>
          setConfirmModal((m) => ({ ...m, open: false, action: null }))
        }
        onConfirm={async () => {
          const act = confirmModal.action;
          setConfirmModal((m) => ({ ...m, open: false, action: null }));
          if (act) await act();
        }}
      />
    </div>
  );
}
