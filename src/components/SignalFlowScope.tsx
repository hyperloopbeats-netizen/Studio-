import React, { useEffect, useRef } from 'react';
import { AudioTelemetry, PatchCable } from '../types/studio';

interface SignalFlowScopeProps {
  telemetryRef: React.MutableRefObject<AudioTelemetry>;
  cables: PatchCable[];
}

const JACK_LABELS: Record<string, string> = {
  player_out: 'MP3-01 OUT',
  amp_in: 'AMP-02 IN',
  amp_out: 'AMP-02 OUT',
  cmp_in: 'CMP-03 IN',
  cmp_out: 'CMP-03 OUT',
  eq_in: 'EQ-04 IN',
  eq_out: 'EQ-04 OUT',
  exp_in: 'EXP-05 IN',
  null_in: 'INV-06 IN',
  null_out: 'INV-06 OUT',
  spc_in: 'SPC-07 IN',
  spc_out: 'SPC-07 OUT',
  rev_in: 'REV-08 IN',
  rev_out: 'REV-08 OUT',
  ncl_in: 'NCL-09 IN',
  ncl_out: 'NCL-09 OUT',
  zdb_in: 'ZDB-10 IN',
  zdb_out: 'ZDB-10 OUT',
  tap_in: 'TAP-11 IN',
  tap_out: 'TAP-11 OUT',
  lux_in: 'LUX-12 IN',
  lux_out: 'LUX-12 OUT',
  exc_in: 'EXC-13 IN',
  exc_out: 'EXC-13 OUT',
  img_in: 'IMG-14 IN',
  img_out: 'IMG-14 OUT',
  fin_in: 'FIN-15 IN',
  fin_out: 'FIN-15 OUT',
};

const CABLE_HEX: Record<string, string> = {
  amber: '#f59e0b',
  crimson: '#ef4444',
  cobalt: '#3b82f6',
  emerald: '#10b981',
  gold: '#eab308',
  cyan: '#06b6d4',
  violet: '#8b5cf6',
  magenta: '#ec4899',
  champagne: '#e8c488',
  copper: '#d97706',
  platinum: '#d4d4d8',
  ivory: '#f4f4f5',
  graphite: '#71717a',
  obsidian: '#52525b',
};

const BAND_NAMES = ['Low <180', 'LowMid', 'HighMid', 'Air >4.2k'];
const BAND_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#ec4899'];

export const SignalFlowScope: React.FC<SignalFlowScopeProps> = ({
  telemetryRef,
  cables,
}) => {
  const fftCanvasRef = useRef<HTMLCanvasElement>(null);
  const flowCanvasRef = useRef<HTMLCanvasElement>(null);
  const cab2CanvasRef = useRef<HTMLCanvasElement>(null);
  const cablesRef = useRef(cables);

  useEffect(() => {
    cablesRef.current = cables;
  }, [cables]);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = (now - start) * 0.001;
      const telem = telemetryRef.current;

      // 1. FFT + Wave-Rounded Envelope Scope
      const fftCanvas = fftCanvasRef.current;
      if (fftCanvas) {
        const rect = fftCanvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.floor(rect.width * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));
        if (fftCanvas.width !== w || fftCanvas.height !== h) {
          fftCanvas.width = w;
          fftCanvas.height = h;
        }
        const ctx = fftCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, w, h);
          const bins = telem.freqBins;
          const gap = 2 * dpr;
          const barW = Math.max(2, (w - gap * (bins.length - 1)) / bins.length);

          for (let i = 0; i < bins.length; i++) {
            const v = bins[i] || 0;
            const barH = Math.max(2 * dpr, v * (h - 6 * dpr));
            ctx.fillStyle =
              v > 0.78
                ? 'rgba(239, 68, 68, 0.78)'
                : v > 0.52
                ? 'rgba(245, 158, 11, 0.72)'
                : 'rgba(16, 185, 129, 0.62)';
            ctx.fillRect(i * (barW + gap), h - barH, barW, barH);
          }

          ctx.beginPath();
          const env = telem.envTrace;
          for (let i = 0; i < env.length; i++) {
            const x = (i / Math.max(1, env.length - 1)) * w;
            const y = h - 3 * dpr - env[i] * (h - 8 * dpr);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.7 * dpr;
          ctx.stroke();
        }
      }

      // 2. Patch Cable Signal Flow Visualizer
      const flowCanvas = flowCanvasRef.current;
      if (flowCanvas) {
        const rect = flowCanvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.floor(rect.width * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));
        if (flowCanvas.width !== w || flowCanvas.height !== h) {
          flowCanvas.width = w;
          flowCanvas.height = h;
        }
        const ctx = flowCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, w, h);
          const activeCables = cablesRef.current;
          if (activeCables.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = `${11 * dpr}px "IBM Plex Mono", monospace`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('No patch cables connected — drag from Rear OUT to IN', 12 * dpr, h / 2);
          } else {
            const rowH = h / Math.max(1, activeCables.length);
            activeCables.forEach((cable, idx) => {
              const cy = rowH * idx + rowH * 0.5;
              const energy = telem.cableEnergy[cable.id] ?? 0;
              const cableHex = CABLE_HEX[cable.tone] || '#f59e0b';
              const xStart = 88 * dpr;
              const xEnd = w - 88 * dpr;

              ctx.fillStyle = '#e4e4e7';
              ctx.font = `600 ${9 * dpr}px "IBM Plex Mono", monospace`;
              ctx.textBaseline = 'middle';
              ctx.textAlign = 'left';
              ctx.fillText(JACK_LABELS[cable.from] || cable.from, 4 * dpr, cy);

              ctx.textAlign = 'right';
              ctx.fillText(JACK_LABELS[cable.to] || cable.to, w - 4 * dpr, cy);

              ctx.strokeStyle = 'rgba(255,255,255,0.14)';
              ctx.lineWidth = 1.6 * dpr;
              ctx.beginPath();
              ctx.moveTo(xStart, cy);
              ctx.lineTo(xEnd, cy);
              ctx.stroke();

              if (xEnd > xStart + 18) {
                const span = xEnd - xStart;
                const speed = 0.45 + energy * 1.9;
                const pulseCount = 4;

                ctx.strokeStyle = cableHex;
                ctx.globalAlpha = 0.55 + energy * 0.45;
                ctx.lineWidth = (1.3 + energy * 1.4) * dpr;
                ctx.beginPath();
                for (let s = 0; s <= 20; s++) {
                  const u = s / 20;
                  const px = xStart + u * span;
                  const amp = (energy * 4.5 + 0.5) * Math.sin(u * Math.PI);
                  const py = cy + Math.sin(u * 14 - t * (6 + energy * 12) + idx) * amp * dpr;
                  if (s === 0) ctx.moveTo(px, py);
                  else ctx.lineTo(px, py);
                }
                ctx.stroke();

                for (let p = 0; p < pulseCount; p++) {
                  const u = ((t * speed + p / pulseCount + idx * 0.21) % 1 + 1) % 1;
                  const px = xStart + u * span;
                  ctx.fillStyle = '#ffffff';
                  ctx.globalAlpha = 0.45 + energy * 0.55;
                  ctx.beginPath();
                  ctx.arc(px, cy, (1.8 + energy * 1.8) * dpr, 0, Math.PI * 2);
                  ctx.fill();
                }
                ctx.globalAlpha = 1;
              }
            });
          }
        }
      }

      // 3. Cabinet II: 4-Band Acoustic Space & True-0dB Silence Amp Readout
      const cab2Canvas = cab2CanvasRef.current;
      if (cab2Canvas) {
        const rect = cab2Canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.floor(rect.width * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));
        if (cab2Canvas.width !== w || cab2Canvas.height !== h) {
          cab2Canvas.width = w;
          cab2Canvas.height = h;
        }
        const ctx = cab2Canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, w, h);

          // Top True-0dB Silence Amp meter bar
          const prox = telem.trueZeroProximity ?? 0;
          const barY = 8 * dpr;
          const barH = 10 * dpr;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, barY, w, barH);
          const grad = ctx.createLinearGradient(0, 0, w, 0);
          grad.addColorStop(0, '#8b5cf6');
          grad.addColorStop(0.65, '#06b6d4');
          grad.addColorStop(1, '#ffffff');
          ctx.fillStyle = grad;
          ctx.fillRect(0, barY, w * prox, barH);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = `600 ${9.5 * dpr}px "IBM Plex Mono", monospace`;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          ctx.fillText(
            `SILENCE: ${telem.silenceAmpDb.toFixed(1)} dBFS`,
            0,
            barY + barH + 5 * dpr
          );
          ctx.textAlign = 'right';
          ctx.fillStyle = '#22d3ee';
          ctx.fillText(
            `REV LIFT +${telem.negLiftDb.toFixed(1)} dB`,
            w,
            barY + barH + 5 * dpr
          );

          // 4 Acoustic Space Band Bars
          const startY = barY + barH + 22 * dpr;
          const availH = Math.max(12 * dpr, h - startY - 14 * dpr);
          const colW = (w - 18 * dpr) / 4;
          telem.bandSpaceLevels.forEach((lvl, i) => {
            const x = i * (colW + 6 * dpr);
            const fh = Math.max(3 * dpr, Math.min(1, lvl * 1.4) * availH);
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(x, startY, colW, availH);

            ctx.fillStyle = BAND_COLORS[i];
            ctx.fillRect(x, startY + availH - fh, colW, fh);

            ctx.fillStyle = '#94a3b8';
            ctx.font = `600 ${8.5 * dpr}px "IBM Plex Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(BAND_NAMES[i], x + colW * 0.5, startY + availH + 3 * dpr);
          });
          // Cab III metrics strip along bottom of Cab II/III matrix canvas
          ctx.fillStyle = '#e8c488';
          ctx.font = `600 ${8.5 * dpr}px "IBM Plex Mono", monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(
            `TAPE ${telem.tapeSaturationPct ?? 0}% · HALL ${Math.round((telem.luxRoomLevel ?? 0) * 100)}% · M/S CORR ${(telem.stereoCorrelation ?? 1).toFixed(2)}`,
            0,
            h - 1 * dpr
          );
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [telemetryRef]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
      <div className="bg-[#12141a] border border-zinc-800 rounded-lg p-2.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono-tabular mb-1.5">
          <span>Tri-Cabinet Patch Flow</span>
          <span>{cables.length} Links</span>
        </div>
        <canvas ref={flowCanvasRef} className="w-full h-36 block" />
      </div>

      <div className="bg-[#12141a] border border-zinc-800 rounded-lg p-2.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono-tabular mb-1.5">
          <span>FFT + Wave-Rounded Envelope</span>
          <span>Cab I / III Bus</span>
        </div>
        <canvas ref={fftCanvasRef} className="w-full h-36 block" />
      </div>

      <div className="bg-[#12141a] border border-zinc-800 rounded-lg p-2.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono-tabular mb-1.5">
          <span>True-0dB & Luxury Hall Matrix</span>
          <span className="text-cyan-400">Cab II & III</span>
        </div>
        <canvas ref={cab2CanvasRef} className="w-full h-36 block" />
      </div>
    </div>
  );
};
