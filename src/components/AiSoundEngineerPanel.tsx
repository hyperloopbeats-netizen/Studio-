import React, { useEffect, useState } from 'react';
import { RotateCcw, Save, Sliders, Sparkles } from 'lucide-react';
import { AiEngineerPassRecord, AudioTelemetry } from '../types/studio';

interface AiSoundEngineerPanelProps {
  compact?: boolean;
  telemetryRef: React.MutableRefObject<AudioTelemetry>;
  cablesCount: number;
  aiLoading: boolean;
  aiMessage: string | null;
  aiError: string | null;
  latestPass: AiEngineerPassRecord | null;
  passHistory: AiEngineerPassRecord[];
  canUndoAiPass: boolean;
  onRunPrompt: (prompt: string) => Promise<void>;
  onUndoAiPass: () => void;
  onSaveCurrentAsPreset: (name: string) => void;
}

const QUICK_ENGINEERING_PROMPTS: Array<{ label: string; prompt: string }> = [
  {
    label: 'SSL Punch & Analog Tape',
    prompt:
      'Sculpt a punchy SSL 9000G analog master: engage Class-A tube warmth, 15 IPS tape saturation, tighten transients in Sovereign DnD, set SSL VCA glue at 4:1 with 2dB reduction, lift 60Hz weight and 10kHz air, and route through Cab I -> Cab III -> EXP-05.',
  },
  {
    label: 'True-0dB Negative Silence',
    prompt:
      'Activate all Cabinet II Negative Silence modules: invert phase null focus, separate Low (<180Hz) mono center from wide High-Mid/Air acoustic spaces, lift digital silence toward True-0dB with REV-08 and NCL-09, and lock ZDB-10.',
  },
  {
    label: 'Warm Broadcast Vocal',
    prompt:
      'Carve an authoritative radio/broadcast vocal master: engage 75Hz HPF, tighten CMP-03 pause condensation, boost 2.4kHz presence, tame 350Hz mud, dial in subtle plate shimmer, and prioritize Transient + SSL VCA ahead of Brickwall Limiter.',
  },
  {
    label: 'Sub 808 Club Wide',
    prompt:
      'Build a massive club low-end master: drive SUB-01 at 48Hz, mono-anchor bass below 110Hz on IMG-14 while widening M/S stereo sides, boost harmonic exciter sub punch, route Cab I -> Cab II Acoustic Space -> Cab III Tape/Imager -> EXP-05, and guard peaks at -0.2dB.',
  },
];

export const AiSoundEngineerPanel: React.FC<AiSoundEngineerPanelProps> = ({
  compact = false,
  telemetryRef,
  cablesCount,
  aiLoading,
  aiMessage,
  aiError,
  latestPass,
  passHistory,
  canUndoAiPass,
  onRunPrompt,
  onUndoAiPass,
  onSaveCurrentAsPreset,
}) => {
  const [prompt, setPrompt] = useState(QUICK_ENGINEERING_PROMPTS[0].prompt);
  const [liveStats, setLiveStats] = useState({
    rms: 0,
    peak: 0,
    corr: 1,
    gr: 0,
    silenceDb: -72,
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const t = telemetryRef.current;
      setLiveStats({
        rms: t.rms,
        peak: t.peak,
        corr: t.stereoCorrelation,
        gr: t.sslVcaGrDb,
        silenceDb: t.silenceAmpDb,
      });
    }, 180);
    return () => window.clearInterval(id);
  }, [telemetryRef]);

  const handleSubmit = () => {
    if (!prompt.trim() || aiLoading) return;
    void onRunPrompt(prompt.trim());
  };

  return (
    <div className="space-y-3">
      {/* Live System Awareness Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-[#0b0d12] border border-zinc-800 rounded-md text-[11px] font-mono-tabular">
        <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
          <Sliders className="w-3.5 h-3.5" />
          <span>AI Sound Engineer · Full-System Scope (15 Modules + Sovereign + Patchbay)</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-zinc-400">
          <span>RMS {(liveStats.rms * 100).toFixed(0)}%</span>
          <span>Peak {(liveStats.peak * 100).toFixed(0)}%</span>
          <span>Corr {liveStats.corr.toFixed(2)}</span>
          <span>VCA GR {liveStats.gr.toFixed(1)}dB</span>
          <span>{cablesCount} Cables</span>
        </div>
      </div>

      <div className={compact ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-12 gap-3'}>
        {/* Left: Prompt & Quick Presets */}
        <div className={compact ? 'space-y-2.5' : 'md:col-span-6 space-y-2.5'}>
          <textarea
            rows={compact ? 3 : 4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe your sonic goal (e.g. punchy 50Hz sub, warm 15 IPS tape, wide stereo sides, negative silence lift, custom cable chain)..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
          />

          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_ENGINEERING_PROMPTS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setPrompt(q.prompt)}
                className="px-2.5 py-1.5 text-[11px] bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 rounded-md text-left truncate transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={aiLoading || !prompt.trim()}
              onClick={handleSubmit}
              className="flex-1 py-2 px-3.5 text-xs font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {aiLoading ? 'Engineering Full Signal Chain...' : 'Sculpt Sound With AI Engineer'}
              </span>
            </button>

            {canUndoAiPass && (
              <button
                type="button"
                disabled={aiLoading}
                onClick={onUndoAiPass}
                className="py-2 px-3 text-xs font-medium bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revert Pass</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Engineering Manifest & Iterative History */}
        <div className={compact ? 'space-y-2.5' : 'md:col-span-6 space-y-2.5'}>
          {aiError && (
            <div className="p-2.5 bg-red-950/60 border border-red-700/70 rounded-lg text-xs text-red-200">
              {aiError}
            </div>
          )}

          {latestPass ? (
            <div className="p-3 bg-zinc-900/80 border border-zinc-700 rounded-lg space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-amber-300 truncate">
                  {latestPass.presetName}
                </span>
                <button
                  type="button"
                  onClick={() => onSaveCurrentAsPreset(latestPass.presetName)}
                  className="px-2 py-1 text-[10px] font-semibold bg-zinc-100 text-zinc-950 hover:bg-white rounded flex items-center gap-1 shrink-0"
                >
                  <Save className="w-3 h-3" />
                  <span>Save to Library</span>
                </button>
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed">{latestPass.summary}</p>
              {latestPass.signalChainRationale && (
                <p className="text-[11px] text-zinc-400 leading-snug border-t border-zinc-800 pt-1.5">
                  {latestPass.signalChainRationale}
                </p>
              )}
              {latestPass.appliedElements.length > 0 && (
                <div className="pt-1.5 border-t border-zinc-800">
                  <div className="text-[10px] font-mono-tabular text-zinc-500 mb-1">
                    ELEMENTS SCULPTED ({latestPass.appliedElements.length})
                  </div>
                  <div className="text-[11px] font-mono-tabular text-cyan-300 leading-relaxed">
                    {latestPass.appliedElements.join(' · ')}
                  </div>
                </div>
              )}
            </div>
          ) : (
            aiMessage && (
              <div className="p-3 bg-zinc-900/80 border border-zinc-700 rounded-lg text-xs text-zinc-200">
                {aiMessage}
              </div>
            )
          )}

          {!latestPass && !aiError && !aiMessage && (
            <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs text-zinc-400 leading-relaxed">
              Enter any mixing or mastering directive. The AI Sound Engineer reads live telemetry
              and tunes Cabinet I (Player, Tube Amp, Hyper-Compressor 12-band Matrix, EQ, Exporter),
              Cabinet II (Phase Null, 4-Band Acoustic Space, Reversed-Freq Silence Amp, Negative
              Master, True-0dB Bus), Cabinet III (Tape, Luxury Reverb, Exciter, M/S Imager, Reference
              Master), the Sovereign 9-unit DnD chain, and Tri-Cabinet Patchbay routing together.
            </div>
          )}

          {passHistory.length > 1 && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono-tabular text-zinc-500">
                PREVIOUS PASSES (FOLLOW-UP CONTEXT ACTIVE)
              </div>
              <div className="max-h-24 overflow-y-auto studio-scroll space-y-1 pr-1">
                {passHistory.slice(1, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPrompt(item.prompt)}
                    className="w-full text-left px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 rounded text-[11px] flex items-center justify-between gap-2"
                  >
                    <span className="text-zinc-300 truncate">{item.presetName}</span>
                    <span className="text-[10px] font-mono-tabular text-zinc-500 shrink-0">
                      {item.appliedElements.length} sys
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
