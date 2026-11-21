import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Circle,
  Download,
  Eye,
  GripVertical,
  Power,
  Radio,
  Sparkles,
} from 'lucide-react';
import {
  AudioTelemetry,
  RackModuleId,
  RackParameters,
  SovereignUnitId,
  WavExportFormat,
} from '../types/studio';

interface SovereignChainViewProps {
  params: RackParameters;
  telemetryRef: React.MutableRefObject<AudioTelemetry>;
  isBackView: boolean;
  xRayWalls: boolean;
  abstractRacks: boolean;
  showFractal: boolean;
  isExporting: boolean;
  webmSummary: string | null;
  sourceStatus: {
    isTestTonePlaying: boolean;
    isRecordingWebm: boolean;
    webmElapsedSec: number;
    loadedFileName: string | null;
  };
  onToggleBackView: () => void;
  onToggleMasterPower: () => void;
  onToggleTestTone: () => void;
  onToggleWebmRecord: () => void;
  onExportWav: (format: WavExportFormat) => void;
  onToggleXRayWalls: () => void;
  onToggleAbstractRacks: () => void;
  onToggleFractal: () => void;
  onReorderSovereignChain: (nextOrder: SovereignUnitId[]) => void;
  onToggleSovereignBypass: (unitId: SovereignUnitId) => void;
  onUpdateSovereignParam: (
    unitId: 'subGen' | 'transient' | 'vcaComp' | 'limiter',
    key: string,
    value: number
  ) => void;
  onUpdateRackParam: (
    moduleId: RackModuleId,
    controlId: string,
    value: number | boolean | string
  ) => void;
}

const UNIT_META: Record<
  SovereignUnitId,
  {
    code: string;
    name: string;
    rackU: string;
    accent: string;
    inJack: string;
    outJack: string;
  }
> = {
  subGen: {
    code: 'SUB-01',
    name: 'Sub-Bass Generator 808',
    rackU: '2U',
    accent: 'text-amber-300',
    inJack: 'SUB IN L/R',
    outJack: 'SUB OUT L/R',
  },
  tapeSat: {
    code: 'TAP-11',
    name: 'Analog Tape Saturation',
    rackU: '2U',
    accent: 'text-[#e8c488]',
    inJack: 'TAPE IN L/R',
    outJack: 'TAPE OUT L/R',
  },
  exciter: {
    code: 'EXC-13',
    name: 'Harmonic Tube Exciter',
    rackU: '2U',
    accent: 'text-orange-300',
    inJack: 'EXC IN L/R',
    outJack: 'EXC OUT L/R',
  },
  transient: {
    code: 'TRN-04',
    name: 'Master Transient Shaper',
    rackU: '2U',
    accent: 'text-cyan-300',
    inJack: 'TRN IN L/R',
    outJack: 'TRN OUT L/R',
  },
  vcaComp: {
    code: 'SSL-VCA',
    name: 'SSL 9000G Bus Glue Comp',
    rackU: '3U',
    accent: 'text-emerald-300',
    inJack: 'VCA IN L/R',
    outJack: 'VCA OUT L/R',
  },
  reverb: {
    code: 'LUX-12',
    name: 'Luxury Hall Plate Verb',
    rackU: '2U',
    accent: 'text-sky-300',
    inJack: 'REV IN L/R',
    outJack: 'REV OUT L/R',
  },
  limiter: {
    code: 'LIM-00',
    name: 'True-0dB Brickwall Limiter',
    rackU: '3U',
    accent: 'text-rose-300',
    inJack: 'LIM IN L/R',
    outJack: 'LIM OUT L/R',
  },
  fft: {
    code: 'FFT-20K',
    name: '20Hz-20kHz Live Analyzer',
    rackU: '2U',
    accent: 'text-zinc-100',
    inJack: 'TAP IN',
    outJack: 'THRU L/R',
  },
  recorder: {
    code: 'REC-BUS',
    name: 'Dual .WebM & 128k WAV Bus',
    rackU: '2U',
    accent: 'text-cyan-400',
    inJack: 'BUS IN L/R',
    outJack: 'DAC MAIN',
  },
};

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

const LiveFftCanvas: React.FC<{
  telemetryRef: React.MutableRefObject<AudioTelemetry>;
  bypassed: boolean;
  masterPower: boolean;
}> = ({ telemetryRef, bypassed, masterPower }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#07090e';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1;
      for (let gx = 1; gx < 8; gx++) {
        const x = (gx / 8) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let gy = 1; gy < 4; gy++) {
        const y = (gy / 4) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (bypassed || !masterPower) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillText(!masterPower ? 'MASTER POWER OFF' : 'ANALYZER BYPASSED', 10, h * 0.5 + 3);
        return;
      }

      const bins = telemetryRef.current.freqBins;
      const count = bins.length || 32;
      const barW = w / count;

      for (let i = 0; i < count; i++) {
        const val = Math.max(0.02, Math.min(1, bins[i] || 0));
        const barH = val * (h - 8);
        const x = i * barW;
        const y = h - barH;
        const lum = Math.round(145 + val * 110);
        ctx.fillStyle = `rgb(${lum}, ${Math.min(255, lum + 10)}, 255)`;
        ctx.fillRect(x + 1, y, Math.max(1, barW - 2), barH);
      }

      // Overlay continuous polyline
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const val = Math.max(0, Math.min(1, bins[i] || 0));
        const x = (i + 0.5) * barW;
        const y = h - 4 - val * (h - 10);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [bypassed, masterPower, telemetryRef]);

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={68}
      className="w-full h-[68px] rounded border border-zinc-800 bg-[#07090e] block"
    />
  );
};

export const SovereignChainView: React.FC<SovereignChainViewProps> = ({
  params,
  telemetryRef,
  isBackView,
  xRayWalls,
  abstractRacks,
  showFractal,
  isExporting,
  webmSummary,
  sourceStatus,
  onToggleBackView,
  onToggleMasterPower,
  onToggleTestTone,
  onToggleWebmRecord,
  onExportWav,
  onToggleXRayWalls,
  onToggleAbstractRacks,
  onToggleFractal,
  onReorderSovereignChain,
  onToggleSovereignBypass,
  onUpdateSovereignParam,
  onUpdateRackParam,
}) => {
  const [dragUnit, setDragUnit] = useState<SovereignUnitId | null>(null);
  const [hoverUnit, setHoverUnit] = useState<SovereignUnitId | null>(null);
  const [grReadout, setGrReadout] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setGrReadout(telemetryRef.current.sslVcaGrDb || 0);
    }, 120);
    return () => window.clearInterval(id);
  }, [telemetryRef]);

  const order = params.sovereignChain.order;

  const moveUnit = (unitId: SovereignUnitId, dir: -1 | 1) => {
    const idx = order.indexOf(unitId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= order.length) return;
    const next = [...order];
    const [removed] = next.splice(idx, 1);
    next.splice(target, 0, removed);
    onReorderSovereignChain(next);
  };

  const dropOnUnit = (targetId: SovereignUnitId) => {
    if (!dragUnit || dragUnit === targetId) return;
    const fromIdx = order.indexOf(dragUnit);
    const toIdx = order.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...order];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onReorderSovereignChain(next);
    setDragUnit(null);
    setHoverUnit(null);
  };

  return (
    <div className="space-y-3">
      {/* Sovereign Master & Studio Controls Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleMasterPower}
            className={`px-3 py-1.5 text-xs font-mono-tabular font-semibold rounded-md border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              params.masterPower
                ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>POWER: {params.masterPower ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleBackView}
            className={`px-3 py-1.5 text-xs font-mono-tabular rounded-md border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              isBackView
                ? 'bg-cyan-400 text-zinc-950 border-cyan-300 font-semibold'
                : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:border-cyan-400/60'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>{isBackView ? 'Flip to Front [Tab]' : 'Flip to Back (Cabling) [Tab]'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTestTone}
            className={`px-3 py-1.5 text-xs font-mono-tabular rounded-md border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              sourceStatus.isTestTonePlaying
                ? 'bg-amber-400 text-zinc-950 border-amber-300 font-semibold'
                : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{sourceStatus.isTestTonePlaying ? 'Stop 110Hz Tone' : '110Hz Test Tone'}</span>
          </button>
        </div>

        {/* AIM SSL Architecture Quick Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleXRayWalls}
            className={`px-2.5 py-1 text-[11px] font-mono-tabular rounded border flex items-center gap-1 whitespace-nowrap shrink-0 ${
              xRayWalls
                ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>X-Ray Walls: {xRayWalls ? 'ON' : 'AUTO'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleAbstractRacks}
            className={`px-2.5 py-1 text-[11px] font-mono-tabular rounded border whitespace-nowrap shrink-0 ${
              abstractRacks
                ? 'bg-cyan-400 text-zinc-950 border-cyan-300 font-semibold'
                : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            Abstract Racks: {abstractRacks ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={onToggleFractal}
            className={`px-2.5 py-1 text-[11px] font-mono-tabular rounded border flex items-center gap-1 whitespace-nowrap shrink-0 ${
              showFractal
                ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>B&W Fractal: {showFractal ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Drag-and-Drop 9-Unit Rack Chain */}
      <div className="text-[11px] text-zinc-400 flex items-center justify-between">
        <span>
          Drag & drop or use arrows to reorder live DSP processing flow ({order.length} rack modules).
        </span>
        <span className="font-mono-tabular text-zinc-300">
          SSL VCA GR: {grReadout.toFixed(1)} dB
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {order.map((unitId, slotIdx) => {
          const meta = UNIT_META[unitId];
          const bypassed = Boolean(params.sovereignChain.bypass[unitId]);
          const prevUnit = slotIdx > 0 ? UNIT_META[order[slotIdx - 1]] : null;
          const nextUnit = slotIdx < order.length - 1 ? UNIT_META[order[slotIdx + 1]] : null;

          return (
            <div
              key={unitId}
              draggable
              onDragStart={() => setDragUnit(unitId)}
              onDragOver={(e) => {
                e.preventDefault();
                if (hoverUnit !== unitId) setHoverUnit(unitId);
              }}
              onDragLeave={() => {
                if (hoverUnit === unitId) setHoverUnit(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOnUnit(unitId);
              }}
              onDragEnd={() => {
                setDragUnit(null);
                setHoverUnit(null);
              }}
              className={`rounded-lg border p-2.5 space-y-2 transition-colors ${
                hoverUnit === unitId
                  ? 'border-cyan-400 bg-zinc-900'
                  : dragUnit === unitId
                  ? 'border-dashed border-cyan-500/70 opacity-60 bg-zinc-900/50'
                  : bypassed
                  ? 'border-zinc-800 bg-zinc-950/80 opacity-75'
                  : 'border-zinc-700/90 bg-[#101319]'
              }`}
            >
              {/* Unit Header */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <GripVertical className="w-3.5 h-3.5 text-zinc-500 cursor-grab shrink-0" />
                  <span className="text-[10px] font-mono-tabular text-zinc-500 shrink-0">
                    #{slotIdx + 1}
                  </span>
                  <span className={`text-xs font-semibold truncate ${meta.accent}`}>
                    {meta.code} · {meta.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={slotIdx === 0}
                    onClick={() => moveUnit(unitId, -1)}
                    className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-30"
                    aria-label={`Move ${meta.name} earlier`}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={slotIdx === order.length - 1}
                    onClick={() => moveUnit(unitId, 1)}
                    className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-30"
                    aria-label={`Move ${meta.name} later`}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleSovereignBypass(unitId)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono-tabular rounded border ${
                      bypassed
                        ? 'bg-zinc-900 text-zinc-500 border-zinc-700'
                        : 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                    }`}
                  >
                    {bypassed ? 'BYP' : 'ON'}
                  </button>
                </div>
              </div>

              {/* Front Panel vs Back (Cabling) View */}
              {isBackView ? (
                <div className="p-2 rounded bg-black/60 border border-zinc-800 font-mono-tabular text-[10px] space-y-1.5">
                  <div className="flex items-center justify-between text-cyan-300">
                    <span>IN JACK: {meta.inJack}</span>
                    <span className="text-zinc-500">{meta.rackU}</span>
                  </div>
                  <div className="text-zinc-400 truncate">
                    ← Fed from: {prevUnit ? `${prevUnit.code} (${prevUnit.outJack})` : 'EXP-05 Master Bus'}
                  </div>
                  <div className="flex items-center justify-between text-amber-300 pt-1 border-t border-zinc-800/70">
                    <span>OUT JACK: {meta.outJack}</span>
                    <span>{bypassed ? 'HARD BYPASS' : 'DSP WIRED'}</span>
                  </div>
                  <div className="text-zinc-400 truncate">
                    → Feeds into: {nextUnit ? `${nextUnit.code} (${nextUnit.inJack})` : 'Master Power Gate'}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {unitId === 'subGen' && (
                    <>
                      <MiniSlider
                        label="Sub Cutoff"
                        value={params.sovereignChain.subGen.freqHz}
                        min={35}
                        max={90}
                        step={1}
                        display={`${Math.round(params.sovereignChain.subGen.freqHz)} Hz`}
                        onChange={(v) => onUpdateSovereignParam('subGen', 'freqHz', v)}
                      />
                      <MiniSlider
                        label="808 Harmonics"
                        value={params.sovereignChain.subGen.drive}
                        min={0}
                        max={1}
                        step={0.02}
                        display={`${Math.round(params.sovereignChain.subGen.drive * 100)}%`}
                        onChange={(v) => onUpdateSovereignParam('subGen', 'drive', v)}
                      />
                    </>
                  )}

                  {unitId === 'tapeSat' && (
                    <>
                      <MiniSlider
                        label="Tape Warmth"
                        value={params.tapeSat.warmth}
                        min={0}
                        max={1}
                        step={0.02}
                        display={`${Math.round(params.tapeSat.warmth * 100)}%`}
                        onChange={(v) => onUpdateRackParam('tapeSat', 'warmth', v)}
                      />
                      <MiniSlider
                        label="Hysteresis Drive"
                        value={params.tapeSat.saturation}
                        min={0}
                        max={1}
                        step={0.02}
                        display={`${Math.round(params.tapeSat.saturation * 100)}%`}
                        onChange={(v) => onUpdateRackParam('tapeSat', 'saturation', v)}
                      />
                    </>
                  )}

                  {unitId === 'exciter' && (
                    <>
                      <MiniSlider
                        label="Tune Pivot"
                        value={params.harmonicExciter.tuneHz}
                        min={1500}
                        max={8000}
                        step={50}
                        display={`${Math.round(params.harmonicExciter.tuneHz)} Hz`}
                        onChange={(v) => onUpdateRackParam('harmonicExciter', 'tuneHz', v)}
                      />
                      <MiniSlider
                        label="Tube Harmonics"
                        value={params.harmonicExciter.harmonics}
                        min={0}
                        max={1}
                        step={0.02}
                        display={`${Math.round(params.harmonicExciter.harmonics * 100)}%`}
                        onChange={(v) => onUpdateRackParam('harmonicExciter', 'harmonics', v)}
                      />
                    </>
                  )}

                  {unitId === 'transient' && (
                    <>
                      <MiniSlider
                        label="Attack Punch"
                        value={params.sovereignChain.transient.attackDb}
                        min={-6}
                        max={6}
                        step={0.2}
                        display={`${params.sovereignChain.transient.attackDb >= 0 ? '+' : ''}${params.sovereignChain.transient.attackDb.toFixed(1)} dB`}
                        onChange={(v) => onUpdateSovereignParam('transient', 'attackDb', v)}
                      />
                      <MiniSlider
                        label="Body Sustain"
                        value={params.sovereignChain.transient.sustainPct}
                        min={50}
                        max={150}
                        step={2}
                        display={`${Math.round(params.sovereignChain.transient.sustainPct)}%`}
                        onChange={(v) => onUpdateSovereignParam('transient', 'sustainPct', v)}
                      />
                    </>
                  )}

                  {unitId === 'vcaComp' && (
                    <>
                      <MiniSlider
                        label="SSL Threshold"
                        value={params.sovereignChain.vcaComp.threshold}
                        min={-30}
                        max={0}
                        step={0.5}
                        display={`${params.sovereignChain.vcaComp.threshold.toFixed(1)} dB`}
                        onChange={(v) => onUpdateSovereignParam('vcaComp', 'threshold', v)}
                      />
                      <MiniSlider
                        label="Ratio / Makeup"
                        value={params.sovereignChain.vcaComp.ratio}
                        min={2}
                        max={10}
                        step={0.5}
                        display={`${params.sovereignChain.vcaComp.ratio.toFixed(1)}:1`}
                        onChange={(v) => onUpdateSovereignParam('vcaComp', 'ratio', v)}
                      />
                      <MiniSlider
                        label="Makeup Gain"
                        value={params.sovereignChain.vcaComp.makeupGain}
                        min={0.5}
                        max={2.0}
                        step={0.02}
                        display={`${params.sovereignChain.vcaComp.makeupGain.toFixed(2)}x`}
                        onChange={(v) => onUpdateSovereignParam('vcaComp', 'makeupGain', v)}
                      />
                    </>
                  )}

                  {unitId === 'reverb' && (
                    <>
                      <MiniSlider
                        label="Plate Mix"
                        value={params.luxuryVerb.mix}
                        min={0}
                        max={0.85}
                        step={0.02}
                        display={`${Math.round(params.luxuryVerb.mix * 100)}%`}
                        onChange={(v) => onUpdateRackParam('luxuryVerb', 'mix', v)}
                      />
                      <MiniSlider
                        label="Hall Decay"
                        value={params.luxuryVerb.decaySec}
                        min={0.5}
                        max={5.5}
                        step={0.1}
                        display={`${params.luxuryVerb.decaySec.toFixed(1)} s`}
                        onChange={(v) => onUpdateRackParam('luxuryVerb', 'decaySec', v)}
                      />
                    </>
                  )}

                  {unitId === 'limiter' && (
                    <>
                      <MiniSlider
                        label="Brickwall Threshold"
                        value={params.sovereignChain.limiter.thresholdDb}
                        min={-12}
                        max={0}
                        step={0.2}
                        display={`${params.sovereignChain.limiter.thresholdDb.toFixed(1)} dB`}
                        onChange={(v) => onUpdateSovereignParam('limiter', 'thresholdDb', v)}
                      />
                      <MiniSlider
                        label="True-0dB Ceiling"
                        value={params.sovereignChain.limiter.ceilingDb}
                        min={-3}
                        max={0}
                        step={0.1}
                        display={`${params.sovereignChain.limiter.ceilingDb.toFixed(1)} dB`}
                        onChange={(v) => onUpdateSovereignParam('limiter', 'ceilingDb', v)}
                      />
                    </>
                  )}

                  {unitId === 'fft' && (
                    <LiveFftCanvas
                      telemetryRef={telemetryRef}
                      bypassed={bypassed}
                      masterPower={params.masterPower}
                    />
                  )}

                  {unitId === 'recorder' && (
                    <div className="space-y-2 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={onToggleWebmRecord}
                          className={`flex-1 py-1.5 px-2.5 text-[11px] font-semibold rounded border flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                            sourceStatus.isRecordingWebm
                              ? 'bg-red-600 text-white border-red-400'
                              : 'bg-zinc-900 text-cyan-300 border-zinc-700 hover:border-cyan-400'
                          }`}
                        >
                          <Circle className="w-3 h-3" />
                          <span>
                            {sourceStatus.isRecordingWebm
                              ? `Stop .WebM (${formatClock(sourceStatus.webmElapsedSec)})`
                              : 'Record Master .WebM'}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={isExporting}
                          onClick={() => onExportWav(params.exporter.format)}
                          className="py-1.5 px-2.5 text-[11px] font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 rounded flex items-center gap-1 disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          <Download className="w-3 h-3" />
                          <span>128k WAV</span>
                        </button>
                      </div>
                      <div className="text-[10px] font-mono-tabular text-zinc-400 truncate">
                        {webmSummary
                          ? webmSummary
                          : `Source: ${sourceStatus.loadedFileName || 'Live Rack Bus'}`}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface MiniSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

const MiniSlider: React.FC<MiniSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}) => (
  <div className="space-y-0.5">
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono-tabular text-zinc-200">{display}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="studio-slider w-full"
    />
  </div>
);
