import React, { useState } from 'react';
import {
  Cable,
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  Mic,
  Pause,
  Play,
  Radio,
  Square,
  Upload,
} from 'lucide-react';
import {
  AiEngineerPassRecord,
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
import { SignalFlowScope } from './SignalFlowScope';
import { SovereignChainView } from './SovereignChainView';
import { AiSoundEngineerPanel } from './AiSoundEngineerPanel';

type DockTab =
  | 'transport'
  | 'engineer'
  | 'sovereign'
  | 'scope'
  | 'sculpt'
  | 'cab2'
  | 'cab3'
  | 'patchbay';

interface StudioDockProps {
  params: RackParameters;
  cables: PatchCable[];
  telemetryRef: React.MutableRefObject<AudioTelemetry>;
  sourceStatus: {
    isDronePlaying: boolean;
    isTestTonePlaying: boolean;
    isMicActive: boolean;
    isFilePlaying: boolean;
    loadedFileName: string | null;
    hasLoadedFile: boolean;
    isRecordingBus: boolean;
    hasRecordedClip: boolean;
    isRecordingWebm: boolean;
    webmElapsedSec: number;
  };
  playbackProgress: { currentSec: number; durationSec: number };
  routingTemplates: Array<{ id: string; label: string; cables: PatchCable[] }>;
  isExporting: boolean;
  fileLoading: boolean;
  fileError: string | null;
  lastExportSummary: string | null;
  webmSummary: string | null;
  isBackView: boolean;
  xRayWalls: boolean;
  abstractRacks: boolean;
  showFractal: boolean;
  onOpenFilePicker: () => void;
  onUploadFile: (file: File) => void;
  onPlayPauseFile: () => void;
  onStopFile: () => void;
  onSeekFile: (normPos: number) => void;
  onToggleDrone: () => void;
  onToggleTestTone: () => void;
  onToggleMic: () => void;
  onToggleBusRecord: () => void;
  onToggleWebmRecord: () => void;
  onToggleMasterPower: () => void;
  onToggleBackView: () => void;
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
  onUpdateParam: (
    moduleId: RackModuleId,
    controlId: string,
    value: number | boolean | string
  ) => void;
  onApplySensitivityPreset: (preset: SensitivityPresetKey) => void;
  onApplyRoutingTemplate: (cables: PatchCable[]) => void;
  onConnectCable: (from: OutputJackId, to: InputJackId) => void;
  onRemoveCable: (cableId: string) => void;
  onExportWav: (format: WavExportFormat) => void;
  aiLoading: boolean;
  aiMessage: string | null;
  aiError: string | null;
  aiPassHistory: AiEngineerPassRecord[];
  canUndoAiPass: boolean;
  onRunAiDirective: (prompt: string) => Promise<void>;
  onUndoAiPass: () => void;
  onSaveCurrentAsPreset: (name: string) => void;
}

const OUTPUT_JACKS: Array<{ id: OutputJackId; label: string }> = [
  { id: 'player_out', label: 'MP3-01 Player Out (Cab I)' },
  { id: 'amp_out', label: 'AMP-02 Tube Out (Cab I)' },
  { id: 'cmp_out', label: 'CMP-03 Hyper-Cmp Out (Cab I)' },
  { id: 'eq_out', label: 'EQ-04 Mastering Out (Cab I)' },
  { id: 'null_out', label: 'INV-06 Phase Null Out (Cab II)' },
  { id: 'spc_out', label: 'SPC-07 Acoustic Space Out (Cab II)' },
  { id: 'rev_out', label: 'REV-08 Silence Amp Out (Cab II)' },
  { id: 'ncl_out', label: 'NCL-09 Neg Master Out (Cab II)' },
  { id: 'zdb_out', label: 'ZDB-10 Zero-dB Bus Out (Cab II)' },
  { id: 'tap_out', label: 'TAP-11 Tape Sat Out (Cab III)' },
  { id: 'lux_out', label: 'LUX-12 Luxury Hall Out (Cab III)' },
  { id: 'exc_out', label: 'EXC-13 Harmonic Exciter Out (Cab III)' },
  { id: 'img_out', label: 'IMG-14 M/S Imager Out (Cab III)' },
  { id: 'fin_out', label: 'FIN-15 Champagne Stage Out (Cab III)' },
];

const INPUT_JACKS: Array<{ id: InputJackId; label: string }> = [
  { id: 'amp_in', label: 'AMP-02 Tube In (Cab I)' },
  { id: 'cmp_in', label: 'CMP-03 Hyper-Cmp In (Cab I)' },
  { id: 'eq_in', label: 'EQ-04 Mastering In (Cab I)' },
  { id: 'null_in', label: 'INV-06 Phase Null In (Cab II)' },
  { id: 'spc_in', label: 'SPC-07 Acoustic Space In (Cab II)' },
  { id: 'rev_in', label: 'REV-08 Silence Amp In (Cab II)' },
  { id: 'ncl_in', label: 'NCL-09 Neg Master In (Cab II)' },
  { id: 'zdb_in', label: 'ZDB-10 Zero-dB Bus In (Cab II)' },
  { id: 'tap_in', label: 'TAP-11 Tape Sat In (Cab III)' },
  { id: 'lux_in', label: 'LUX-12 Luxury Hall In (Cab III)' },
  { id: 'exc_in', label: 'EXC-13 Harmonic Exciter In (Cab III)' },
  { id: 'img_in', label: 'IMG-14 M/S Imager In (Cab III)' },
  { id: 'fin_in', label: 'FIN-15 Champagne Stage In (Cab III)' },
  { id: 'exp_in', label: 'EXP-05 128k Bus In (Cab I)' },
];

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const CABLE_DOT_COLORS: Record<string, string> = {
  amber: 'bg-amber-500',
  crimson: 'bg-red-500',
  cobalt: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  gold: 'bg-yellow-500',
  cyan: 'bg-cyan-400',
  violet: 'bg-violet-500',
  magenta: 'bg-pink-500',
  champagne: 'bg-[#e8c488]',
  copper: 'bg-amber-600',
  platinum: 'bg-zinc-300',
  ivory: 'bg-zinc-100',
  graphite: 'bg-zinc-500',
  obsidian: 'bg-zinc-700',
};

const BAND_CONTROLS = [
  { key: 'low', title: 'Band 1 · Sub/Low <180 Hz', accent: 'text-violet-400' },
  { key: 'lowMid', title: 'Band 2 · Low-Mid 180-900', accent: 'text-cyan-400' },
  { key: 'highMid', title: 'Band 3 · High-Mid 900-4.2k', accent: 'text-emerald-400' },
  { key: 'high', title: 'Band 4 · Air >4.2 kHz', accent: 'text-pink-400' },
] as const;

export const StudioDock: React.FC<StudioDockProps> = ({
  params,
  cables,
  telemetryRef,
  sourceStatus,
  playbackProgress,
  routingTemplates,
  isExporting,
  fileLoading,
  fileError,
  lastExportSummary,
  webmSummary,
  isBackView,
  xRayWalls,
  abstractRacks,
  showFractal,
  onOpenFilePicker,
  onUploadFile,
  onPlayPauseFile,
  onStopFile,
  onSeekFile,
  onToggleDrone,
  onToggleTestTone,
  onToggleMic,
  onToggleBusRecord,
  onToggleWebmRecord,
  onToggleMasterPower,
  onToggleBackView,
  onToggleXRayWalls,
  onToggleAbstractRacks,
  onToggleFractal,
  onReorderSovereignChain,
  onToggleSovereignBypass,
  onUpdateSovereignParam,
  onUpdateParam,
  onApplySensitivityPreset,
  onApplyRoutingTemplate,
  onConnectCable,
  onRemoveCable,
  onExportWav,
  aiLoading,
  aiMessage,
  aiError,
  aiPassHistory,
  canUndoAiPass,
  onRunAiDirective,
  onUndoAiPass,
  onSaveCurrentAsPreset,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('transport');
  const [show4xMatrix, setShow4xMatrix] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [newFrom, setNewFrom] = useState<OutputJackId>('player_out');
  const [newTo, setNewTo] = useState<InputJackId>('amp_in');

  const progressRatio =
    playbackProgress.durationSec > 0
      ? Math.min(1, playbackProgress.currentSec / playbackProgress.durationSec)
      : 0;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onUploadFile(f);
      }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(960px,94vw)] flex flex-col items-center pointer-events-none"
    >
      {/* Collapse Toggle Handle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="pointer-events-auto mb-1.5 px-3.5 py-1.5 rounded-t-lg bg-[#14161c]/95 border border-b-0 border-zinc-700 text-[11px] font-medium text-zinc-300 hover:text-amber-400 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
      >
        {collapsed ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
        <span>{collapsed ? 'Show Studio Console' : 'Hide Console'}</span>
      </button>

      {!collapsed && (
        <div
          className={`pointer-events-auto w-full bg-[#14161c]/95 border rounded-xl shadow-2xl overflow-hidden transition-colors ${
            dragOver ? 'border-amber-400' : 'border-zinc-700/90'
          }`}
        >
          {/* Tab Bar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800/90 overflow-x-auto bg-[#101217]">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'transport', label: 'Transport & 128k WAV' },
                  { id: 'engineer', label: 'AI Sound Engineer' },
                  { id: 'sovereign', label: 'Sovereign DnD Chain' },
                  { id: 'scope', label: 'Signal Flow & Scope' },
                  { id: 'sculpt', label: 'Cab I · Amp / Cmp / EQ' },
                  { id: 'cab2', label: 'Cab II · Negative Silence' },
                  { id: 'cab3', label: 'Cab III · Luxury Master' },
                  { id: 'patchbay', label: 'Tri Patchbay' },
                ] as Array<{ id: DockTab; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? tab.id === 'sovereign'
                        ? 'bg-cyan-400 text-zinc-950 font-semibold'
                        : tab.id === 'cab2'
                        ? 'bg-cyan-400 text-zinc-950 font-semibold'
                        : tab.id === 'cab3'
                        ? 'bg-[#e8c488] text-zinc-950 font-semibold'
                        : 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-400 font-mono-tabular whitespace-nowrap shrink-0">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  params.masterPower
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {params.masterPower ? 'PWR ON' : 'PWR OFF'}
              </span>
              <span className="max-w-[160px] truncate text-amber-400/90">
                {sourceStatus.loadedFileName || '432Hz Master Buffer'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{cables.length} Cables</span>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-3.5 max-h-[38vh] overflow-y-auto studio-scroll">
            {activeTab === 'transport' && (
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  {/* Source & Transport */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={fileLoading}
                      onClick={onOpenFilePicker}
                      className="px-3.5 py-2 text-xs font-semibold bg-amber-500/15 border border-amber-500/50 hover:border-amber-400 text-amber-200 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>{fileLoading ? 'Opening MP3...' : 'Load MP3 / Audio'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onPlayPauseFile}
                      disabled={!sourceStatus.hasLoadedFile}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        sourceStatus.hasLoadedFile
                          ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                          : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                      }`}
                    >
                      {sourceStatus.isFilePlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Play</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={onStopFile}
                      disabled={!sourceStatus.hasLoadedFile}
                      className="px-2.5 py-2 text-xs bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 rounded-lg disabled:opacity-40 whitespace-nowrap shrink-0"
                      aria-label="Stop track"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={onToggleDrone}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        sourceStatus.isDronePlaying
                          ? 'bg-sky-500 text-zinc-950 border-sky-400 font-semibold'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{sourceStatus.isDronePlaying ? 'Stop 432Hz' : '432Hz Drone'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onToggleMic}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        sourceStatus.isMicActive
                          ? 'bg-red-500 text-zinc-950 border-red-400 font-semibold'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{sourceStatus.isMicActive ? 'Mic Active' : 'Live Mic'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onToggleBusRecord}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        sourceStatus.isRecordingBus
                          ? 'bg-red-600 text-white border-red-400 font-semibold'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      <Circle className="w-3 h-3" />
                      <span>
                        {sourceStatus.isRecordingBus
                          ? 'Stop Capture'
                          : sourceStatus.hasRecordedClip
                          ? 'Re-Capture Bus'
                          : 'Capture Bus'}
                      </span>
                    </button>
                  </div>

                  {/* 128k WAV Exporter */}
                  <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 md:border-l border-zinc-800 pt-3 md:pt-0 md:pl-4">
                    <select
                      aria-label="WAV Export Bitrate Format"
                      value={params.exporter.format}
                      onChange={(e) =>
                        onUpdateParam('exporter', 'format', e.target.value as WavExportFormat)
                      }
                      className="px-2.5 py-2 text-xs font-mono-tabular bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg focus:outline-none focus:border-amber-400"
                    >
                      <option value="128k_8khz_16bit">128 kbps WAV (8kHz · 16-bit Mono)</option>
                      <option value="128k_16khz_8bit">128 kbps WAV (16kHz · 8-bit Mono)</option>
                      <option value="studio_44k_16bit">Studio WAV (44.1kHz · 16-bit Stereo)</option>
                    </select>

                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => onExportWav(params.exporter.format)}
                      className="px-4 py-2 text-xs font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isExporting ? 'Rendering...' : 'Export 128k WAV'}</span>
                    </button>
                  </div>
                </div>

                {fileError && (
                  <div className="px-3 py-1.5 bg-red-950/70 border border-red-700/70 rounded-md text-xs text-red-200">
                    {fileError}
                  </div>
                )}

                {/* MP3 Track Scrub Bar & Export Metadata */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-[11px] font-mono-tabular text-zinc-400 w-10">
                      {formatTime(playbackProgress.currentSec)}
                    </span>
                    <input
                      type="range"
                      aria-label="Track Position"
                      min={0}
                      max={1}
                      step={0.002}
                      disabled={!sourceStatus.hasLoadedFile}
                      value={progressRatio}
                      onChange={(e) => onSeekFile(parseFloat(e.target.value))}
                      className="studio-slider flex-1 disabled:opacity-40"
                    />
                    <span className="text-[11px] font-mono-tabular text-zinc-400 w-10 text-right">
                      {formatTime(playbackProgress.durationSec)}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-tabular text-zinc-400">
                    {lastExportSummary
                      ? `Last Export: ${lastExportSummary}`
                      : 'Drop an MP3 / WAV / OGG file onto console or click Load MP3'}
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'engineer' && (
              <AiSoundEngineerPanel
                telemetryRef={telemetryRef}
                cablesCount={cables.length}
                aiLoading={aiLoading}
                aiMessage={aiMessage}
                aiError={aiError}
                latestPass={aiPassHistory[0] ?? null}
                passHistory={aiPassHistory}
                canUndoAiPass={canUndoAiPass}
                onRunPrompt={onRunAiDirective}
                onUndoAiPass={onUndoAiPass}
                onSaveCurrentAsPreset={onSaveCurrentAsPreset}
              />
            )}

            {activeTab === 'sovereign' && (
              <SovereignChainView
                params={params}
                telemetryRef={telemetryRef}
                isBackView={isBackView}
                xRayWalls={xRayWalls}
                abstractRacks={abstractRacks}
                showFractal={showFractal}
                isExporting={isExporting}
                webmSummary={webmSummary}
                sourceStatus={sourceStatus}
                onToggleBackView={onToggleBackView}
                onToggleMasterPower={onToggleMasterPower}
                onToggleTestTone={onToggleTestTone}
                onToggleWebmRecord={onToggleWebmRecord}
                onExportWav={onExportWav}
                onToggleXRayWalls={onToggleXRayWalls}
                onToggleAbstractRacks={onToggleAbstractRacks}
                onToggleFractal={onToggleFractal}
                onReorderSovereignChain={onReorderSovereignChain}
                onToggleSovereignBypass={onToggleSovereignBypass}
                onUpdateSovereignParam={onUpdateSovereignParam}
                onUpdateRackParam={onUpdateParam}
              />
            )}

            {activeTab === 'scope' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-zinc-400 mr-1">Sensitivity Preset:</span>
                    {(['bass', 'vocal', 'quiet'] as SensitivityPresetKey[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onApplySensitivityPreset(key)}
                        className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                          params.compressor.preset === key
                            ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        {key === 'bass'
                          ? 'Bass Club'
                          : key === 'vocal'
                          ? 'Vocal / Voice'
                          : 'Quiet Room'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono-tabular text-zinc-400">
                    <span>
                      Hyper-Gap: {params.compressor.hyperEnabled ? 'Active' : 'Bypassed'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateParam(
                          'compressor',
                          'autoBeatShockwaves',
                          !params.compressor.autoBeatShockwaves
                        )
                      }
                      className="text-zinc-200 hover:underline"
                    >
                      Beat Trigger: {params.compressor.autoBeatShockwaves ? 'Auto' : 'Off'}
                    </button>
                  </div>
                </div>
                <SignalFlowScope telemetryRef={telemetryRef} cables={cables} />
              </div>
            )}

            {activeTab === 'sculpt' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Amp Column */}
                  <div className="space-y-2 border-b md:border-b-0 md:border-r border-zinc-800 pb-3 md:pb-0 md:pr-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                      <span>AMP-02 Tube Stage</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam('amp', 'hpfEnabled', !params.amp.hpfEnabled)
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border ${
                            params.amp.hpfEnabled
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          75Hz HPF
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateParam('amp', 'power', !params.amp.power)}
                          className={`px-2 py-0.5 text-[10px] rounded border ${
                            params.amp.power
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          {params.amp.power ? 'Active' : 'Bypass'}
                        </button>
                      </div>
                    </div>
                    <SliderRow
                      label="Tube Drive"
                      value={params.amp.drive}
                      min={0}
                      max={1}
                      step={0.01}
                      display={`${Math.round(params.amp.drive * 100)}%`}
                      onChange={(v) => onUpdateParam('amp', 'drive', v)}
                    />
                    <SliderRow
                      label="Tube Bias"
                      value={params.amp.bias}
                      min={-0.5}
                      max={0.5}
                      step={0.01}
                      display={params.amp.bias.toFixed(2)}
                      onChange={(v) => onUpdateParam('amp', 'bias', v)}
                    />
                    <SliderRow
                      label="Output Gain"
                      value={params.amp.outputGain}
                      min={0.2}
                      max={2.0}
                      step={0.02}
                      display={`${params.amp.outputGain.toFixed(2)}x`}
                      onChange={(v) => onUpdateParam('amp', 'outputGain', v)}
                    />
                  </div>

                  {/* Hyper-Compressor Column */}
                  <div className="space-y-2 border-b md:border-b-0 md:border-r border-zinc-800 pb-3 md:pb-0 md:pr-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                      <span>CMP-03 Hyper-Gap</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam(
                              'compressor',
                              'hyperEnabled',
                              !params.compressor.hyperEnabled
                            )
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border ${
                            params.compressor.hyperEnabled
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          Hyper {params.compressor.hyperEnabled ? 'ON' : 'OFF'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShow4xMatrix((s) => !s)}
                          className="px-2 py-0.5 text-[10px] rounded border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                        >
                          {show4xMatrix ? 'Hide 4x Matrix' : '4x Matrix (12)'}
                        </button>
                      </div>
                    </div>
                    <SliderRow
                      label="Threshold"
                      value={params.compressor.threshold}
                      min={-48}
                      max={0}
                      step={1}
                      display={`${params.compressor.threshold} dB`}
                      onChange={(v) => onUpdateParam('compressor', 'threshold', v)}
                    />
                    <SliderRow
                      label="Ratio"
                      value={params.compressor.ratio}
                      min={1}
                      max={20}
                      step={0.5}
                      display={`${params.compressor.ratio.toFixed(1)}:1`}
                      onChange={(v) => onUpdateParam('compressor', 'ratio', v)}
                    />
                    <SliderRow
                      label="Attack / Release"
                      value={params.compressor.attack}
                      min={0.001}
                      max={0.25}
                      step={0.002}
                      display={`${Math.round(params.compressor.attack * 1000)} ms`}
                      onChange={(v) => onUpdateParam('compressor', 'attack', v)}
                    />
                    <SliderRow
                      label="Makeup Gain"
                      value={params.compressor.makeupGain}
                      min={0.5}
                      max={2.5}
                      step={0.05}
                      display={`${params.compressor.makeupGain.toFixed(2)}x`}
                      onChange={(v) => onUpdateParam('compressor', 'makeupGain', v)}
                    />
                  </div>

                  {/* 4-Band EQ Column */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                      <span>EQ-04 Mastering EQ</span>
                      <button
                        type="button"
                        onClick={() => onUpdateParam('eq', 'power', !params.eq.power)}
                        className={`px-2 py-0.5 text-[10px] rounded border ${
                          params.eq.power
                            ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                            : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                        }`}
                      >
                        {params.eq.power ? 'Active' : 'Bypass'}
                      </button>
                    </div>
                    <SliderRow
                      label="60Hz Low"
                      value={params.eq.lowGain}
                      min={-12}
                      max={12}
                      step={0.2}
                      display={`${params.eq.lowGain >= 0 ? '+' : ''}${params.eq.lowGain.toFixed(1)} dB`}
                      onChange={(v) => onUpdateParam('eq', 'lowGain', v)}
                    />
                    <SliderRow
                      label="350Hz Low-Mid"
                      value={params.eq.lowMidGain}
                      min={-12}
                      max={12}
                      step={0.2}
                      display={`${params.eq.lowMidGain >= 0 ? '+' : ''}${params.eq.lowMidGain.toFixed(1)} dB`}
                      onChange={(v) => onUpdateParam('eq', 'lowMidGain', v)}
                    />
                    <SliderRow
                      label="2.4kHz High-Mid"
                      value={params.eq.highMidGain}
                      min={-12}
                      max={12}
                      step={0.2}
                      display={`${params.eq.highMidGain >= 0 ? '+' : ''}${params.eq.highMidGain.toFixed(1)} dB`}
                      onChange={(v) => onUpdateParam('eq', 'highMidGain', v)}
                    />
                    <SliderRow
                      label="10kHz High"
                      value={params.eq.highGain}
                      min={-12}
                      max={12}
                      step={0.2}
                      display={`${params.eq.highGain >= 0 ? '+' : ''}${params.eq.highGain.toFixed(1)} dB`}
                      onChange={(v) => onUpdateParam('eq', 'highGain', v)}
                    />
                  </div>
                </div>

                {/* Expandable 4-Bank x 3-Slider (12 Sliders) Hyper-Gap Matrix */}
                {show4xMatrix && (
                  <div className="pt-3 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2">
                      <div className="text-[11px] font-semibold text-zinc-300">
                        Bank 1 · Sub-Silence Pull
                      </div>
                      <SliderRow
                        label="1A. Silence Floor"
                        value={params.compressor.s1Floor}
                        min={0.005}
                        max={0.25}
                        step={0.005}
                        display={params.compressor.s1Floor.toFixed(3)}
                        onChange={(v) => onUpdateParam('compressor', 's1Floor', v)}
                      />
                      <SliderRow
                        label="1B. Gap Condense"
                        value={params.compressor.s1Condense}
                        min={0}
                        max={1}
                        step={0.02}
                        display={params.compressor.s1Condense.toFixed(2)}
                        onChange={(v) => onUpdateParam('compressor', 's1Condense', v)}
                      />
                      <SliderRow
                        label="1C. Wave Round (Sin)"
                        value={params.compressor.s1Round}
                        min={0}
                        max={1}
                        step={0.02}
                        display={params.compressor.s1Round.toFixed(2)}
                        onChange={(v) => onUpdateParam('compressor', 's1Round', v)}
                      />
                    </div>

                    <div className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2">
                      <div className="text-[11px] font-semibold text-zinc-300">
                        Bank 2 · Mid Pause Isolator
                      </div>
                      <SliderRow
                        label="2A. Silence Floor"
                        value={params.compressor.s2Floor}
                        min={0.005}
                        max={0.25}
                        step={0.005}
                        display={params.compressor.s2Floor.toFixed(3)}
                        onChange={(v) => onUpdateParam('compressor', 's2Floor', v)}
                      />
                      <SliderRow
                        label="2B. Gap Condense"
                        value={params.compressor.s2Condense}
                        min={0}
                        max={1}
                        step={0.02}
                        display={params.compressor.s2Condense.toFixed(2)}
                        onChange={(v) => onUpdateParam('compressor', 's2Condense', v)}
                      />
                      <SliderRow
                        label="2C. Wave Round (Cos)"
                        value={params.compressor.s2Round}
                        min={0}
                        max={1}
                        step={0.02}
                        display={params.compressor.s2Round.toFixed(2)}
                        onChange={(v) => onUpdateParam('compressor', 's2Round', v)}
                      />
                    </div>

                    <div className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2">
                      <div className="text-[11px] font-semibold text-zinc-300">
                        Bank 3 · Air Tail Condenser
                      </div>
                      <SliderRow
                        label="3A. Silence Floor"
                        value={params.compressor.s3Floor}
                        min={0.005}
                        max={0.25}
                        step={0.005}
                        display={params.compressor.s3Floor.toFixed(3)}
                        onChange={(v) => onUpdateParam('compressor', 's3Floor', v)}
                      />
                      <SliderRow
                        label="3B. Gap Condense"
                        value={params.compressor.s3Condense}
                        min={0}
                        max={1}
                        step={0.02}
                        display={params.compressor.s3Condense.toFixed(2)}
                        onChange={(v) => onUpdateParam('compressor', 's3Condense', v)}
                      />
                      <SliderRow
                        label="3C. Harmonic Round"
                        value={params.compressor.s3Round}
                        min={0}
                        max={1}
                        step={0.02}
                        display={params.compressor.s3Round.toFixed(2)}
                        onChange={(v) => onUpdateParam('compressor', 's3Round', v)}
                      />
                    </div>

                    <div className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2">
                      <div className="text-[11px] font-semibold text-zinc-300">
                        Bank 4 · Dynamic Wave Bus
                      </div>
                      <SliderRow
                        label="4A. Dynamic Density"
                        value={params.compressor.s4Density}
                        min={0}
                        max={1}
                        step={0.02}
                        display={params.compressor.s4Density.toFixed(2)}
                        onChange={(v) => onUpdateParam('compressor', 's4Density', v)}
                      />
                      <SliderRow
                        label="4B. Wave Freq (Hz)"
                        value={params.compressor.s4WaveHz}
                        min={1}
                        max={24}
                        step={0.25}
                        display={`${params.compressor.s4WaveHz.toFixed(2)} Hz`}
                        onChange={(v) => onUpdateParam('compressor', 's4WaveHz', v)}
                      />
                      <SliderRow
                        label="4C. Splice Wave Round"
                        value={params.compressor.s4SpliceRound}
                        min={0}
                        max={1}
                        step={0.02}
                        display={params.compressor.s4SpliceRound.toFixed(2)}
                        onChange={(v) => onUpdateParam('compressor', 's4SpliceRound', v)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cab2' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 border-b md:border-b-0 md:border-r border-zinc-800 pb-3 md:pb-0 md:pr-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                      <span>INV-06 Null & ZDB-10 Bus</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam(
                              'phaseNull',
                              'polarityInvert',
                              !params.phaseNull.polarityInvert
                            )
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.phaseNull.polarityInvert
                              ? 'bg-cyan-400 text-zinc-950 border-cyan-300 font-semibold'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          -180° Pol
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam('phaseNull', 'power', !params.phaseNull.power)
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.phaseNull.power
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          {params.phaseNull.power ? 'Active' : 'Bypass'}
                        </button>
                      </div>
                    </div>
                    <SliderRow
                      label="Negative Cancel Depth"
                      value={params.phaseNull.cancelDepth}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round(params.phaseNull.cancelDepth * 100)}%`}
                      onChange={(v) => onUpdateParam('phaseNull', 'cancelDepth', v)}
                    />
                    <SliderRow
                      label="Digital Silence Null Floor"
                      value={params.phaseNull.nullFloor}
                      min={0.002}
                      max={0.25}
                      step={0.002}
                      display={params.phaseNull.nullFloor.toFixed(3)}
                      onChange={(v) => onUpdateParam('phaseNull', 'nullFloor', v)}
                    />
                    <SliderRow
                      label="0dB Pocket Focus"
                      value={params.phaseNull.zeroDbFocus}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round(params.phaseNull.zeroDbFocus * 100)}%`}
                      onChange={(v) => onUpdateParam('phaseNull', 'zeroDbFocus', v)}
                    />
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateParam('zeroDbBus', 'trueZeroLock', !params.zeroDbBus.trueZeroLock)
                        }
                        className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                          params.zeroDbBus.trueZeroLock
                            ? 'bg-cyan-400 text-zinc-950 border-cyan-300 font-semibold'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        ZDB True-0dB Lock: {params.zeroDbBus.trueZeroLock ? 'ON' : 'OFF'}
                      </button>
                      <span className="text-[11px] font-mono-tabular text-zinc-400">
                        Trim {params.zeroDbBus.busTrim.toFixed(2)}x
                      </span>
                    </div>
                    <SliderRow
                      label="ZDB Phase Coherence"
                      value={params.zeroDbBus.phaseCoherence}
                      min={-1}
                      max={1}
                      step={0.02}
                      display={params.zeroDbBus.phaseCoherence.toFixed(2)}
                      onChange={(v) => onUpdateParam('zeroDbBus', 'phaseCoherence', v)}
                    />
                  </div>

                  <div className="space-y-2 border-b md:border-b-0 md:border-r border-zinc-800 pb-3 md:pb-0 md:pr-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                      <span>REV-08 Silence Amp</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam('revAmp', 'trueZeroClamp', !params.revAmp.trueZeroClamp)
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.revAmp.trueZeroClamp
                              ? 'bg-emerald-400 text-zinc-950 border-emerald-300 font-semibold'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          0dB Clamp
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateParam('revAmp', 'power', !params.revAmp.power)}
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.revAmp.power
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          {params.revAmp.power ? 'Active' : 'Bypass'}
                        </button>
                      </div>
                    </div>
                    <SliderRow
                      label="Reversed-Freq Spectral Tilt"
                      value={params.revAmp.reverseFreq}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round(params.revAmp.reverseFreq * 100)}%`}
                      onChange={(v) => onUpdateParam('revAmp', 'reverseFreq', v)}
                    />
                    <SliderRow
                      label="Negative Silence Amp Gain"
                      value={params.revAmp.negAmpGainDb}
                      min={0}
                      max={24}
                      step={0.2}
                      display={`+${params.revAmp.negAmpGainDb.toFixed(1)} dB`}
                      onChange={(v) => onUpdateParam('revAmp', 'negAmpGainDb', v)}
                    />
                    <SliderRow
                      label="Mirror Pivot Frequency"
                      value={params.revAmp.mirrorPivotHz}
                      min={200}
                      max={6000}
                      step={20}
                      display={`${Math.round(params.revAmp.mirrorPivotHz)} Hz`}
                      onChange={(v) => onUpdateParam('revAmp', 'mirrorPivotHz', v)}
                    />
                    <SliderRow
                      label="ZDB Bus Master Trim"
                      value={params.zeroDbBus.busTrim}
                      min={0.2}
                      max={1.5}
                      step={0.02}
                      display={`${params.zeroDbBus.busTrim.toFixed(2)}x`}
                      onChange={(v) => onUpdateParam('zeroDbBus', 'busTrim', v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-pink-300">
                      <span>NCL-09 Neg Master</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam('negMaster', 'gateInvert', !params.negMaster.gateInvert)
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.negMaster.gateInvert
                              ? 'bg-pink-400 text-zinc-950 border-pink-300 font-semibold'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          Inv Gate
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam('negMaster', 'power', !params.negMaster.power)
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.negMaster.power
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          {params.negMaster.power ? 'Active' : 'Bypass'}
                        </button>
                      </div>
                    </div>
                    <SliderRow
                      label="Negative Threshold"
                      value={params.negMaster.negThreshold}
                      min={-60}
                      max={-3}
                      step={1}
                      display={`${params.negMaster.negThreshold} dB`}
                      onChange={(v) => onUpdateParam('negMaster', 'negThreshold', v)}
                    />
                    <SliderRow
                      label="Inverse Ratio"
                      value={params.negMaster.invRatio}
                      min={1}
                      max={20}
                      step={0.5}
                      display={`${params.negMaster.invRatio.toFixed(1)}:1`}
                      onChange={(v) => onUpdateParam('negMaster', 'invRatio', v)}
                    />
                    <SliderRow
                      label="Silence Lift to 0dB"
                      value={params.negMaster.silenceLift}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round(params.negMaster.silenceLift * 100)}%`}
                      onChange={(v) => onUpdateParam('negMaster', 'silenceLift', v)}
                    />
                    <SliderRow
                      label="Gate Floor / Limiter Ceiling"
                      value={params.negMaster.limiterCeilingDb}
                      min={-3}
                      max={0}
                      step={0.1}
                      display={`${params.negMaster.limiterCeilingDb.toFixed(1)} dB`}
                      onChange={(v) => onUpdateParam('negMaster', 'limiterCeilingDb', v)}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-violet-300">
                        SPC-07 4-Band Acoustic Space Matrix
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateParam('acousticSpace', 'power', !params.acousticSpace.power)
                        }
                        className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                          params.acousticSpace.power
                            ? 'bg-violet-400 text-zinc-950 border-violet-300 font-semibold'
                            : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                        }`}
                      >
                        {params.acousticSpace.power ? 'Active' : 'Bypass'}
                      </button>
                    </div>
                    <div className="w-48">
                      <SliderRow
                        label="Room Width"
                        value={params.acousticSpace.roomWidth}
                        min={0}
                        max={1.5}
                        step={0.02}
                        display={`${params.acousticSpace.roomWidth.toFixed(2)}x`}
                        onChange={(v) => onUpdateParam('acousticSpace', 'roomWidth', v)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {BAND_CONTROLS.map(({ key, title, accent }) => {
                      const band = params.acousticSpace[key];
                      return (
                        <div
                          key={key}
                          className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[11px] font-semibold ${accent}`}>{title}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateParam('acousticSpace', `${key}.solo`, !band.solo)
                                }
                                className={`px-1.5 py-0.5 text-[10px] rounded border ${
                                  band.solo
                                    ? 'bg-amber-400 text-zinc-950 border-amber-300 font-semibold'
                                    : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                                }`}
                              >
                                S
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateParam('acousticSpace', `${key}.enabled`, !band.enabled)
                                }
                                className={`px-1.5 py-0.5 text-[10px] rounded border ${
                                  band.enabled
                                    ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                                    : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                                }`}
                              >
                                {band.enabled ? 'ON' : 'M'}
                              </button>
                            </div>
                          </div>
                          <SliderRow
                            label="Pan"
                            value={band.pan}
                            min={-1}
                            max={1}
                            step={0.02}
                            display={
                              Math.abs(band.pan) < 0.03
                                ? 'C'
                                : band.pan < 0
                                ? `L${Math.round(Math.abs(band.pan) * 100)}`
                                : `R${Math.round(band.pan * 100)}`
                            }
                            onChange={(v) => onUpdateParam('acousticSpace', `${key}.pan`, v)}
                          />
                          <SliderRow
                            label="Space Depth (Haas)"
                            value={band.spaceDepth}
                            min={0}
                            max={1}
                            step={0.02}
                            display={`${Math.round(band.spaceDepth * 24)} ms`}
                            onChange={(v) =>
                              onUpdateParam('acousticSpace', `${key}.spaceDepth`, v)
                            }
                          />
                          <SliderRow
                            label="Neg Gain"
                            value={band.negGain}
                            min={-1.5}
                            max={1.5}
                            step={0.05}
                            display={`${band.negGain >= 0 ? '+' : ''}${band.negGain.toFixed(2)}x`}
                            onChange={(v) => onUpdateParam('acousticSpace', `${key}.negGain`, v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cab3' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* TAP-11 Analog Tape & Wow/Flutter */}
                  <div className="space-y-2 border-b md:border-b-0 md:border-r border-zinc-800 pb-3 md:pb-0 md:pr-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#e8c488]">
                      <span>TAP-11 Analog Tape Deck</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam('tapeSat', 'ips30', !params.tapeSat.ips30)
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.tapeSat.ips30
                              ? 'bg-[#e8c488] text-zinc-950 border-[#e8c488] font-semibold'
                              : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                          }`}
                        >
                          {params.tapeSat.ips30 ? '30 IPS' : '15 IPS'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam('tapeSat', 'power', !params.tapeSat.power)
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.tapeSat.power
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          {params.tapeSat.power ? 'Active' : 'Bypass'}
                        </button>
                      </div>
                    </div>
                    <SliderRow
                      label="Tape Warmth"
                      value={params.tapeSat.warmth}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round(params.tapeSat.warmth * 100)}%`}
                      onChange={(v) => onUpdateParam('tapeSat', 'warmth', v)}
                    />
                    <SliderRow
                      label="Hysteresis Saturation"
                      value={params.tapeSat.saturation}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round(params.tapeSat.saturation * 100)}%`}
                      onChange={(v) => onUpdateParam('tapeSat', 'saturation', v)}
                    />
                    <SliderRow
                      label="Wow & Flutter"
                      value={params.tapeSat.wowFlutter}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round(params.tapeSat.wowFlutter * 100)}%`}
                      onChange={(v) => onUpdateParam('tapeSat', 'wowFlutter', v)}
                    />
                  </div>

                  {/* LUX-12 Ambient Luxury Hall Reverb */}
                  <div className="space-y-2 border-b md:border-b-0 md:border-r border-zinc-800 pb-3 md:pb-0 md:pr-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                      <span>LUX-12 Luxury Hall Verb</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam(
                              'luxuryVerb',
                              'stereoSpread',
                              !params.luxuryVerb.stereoSpread
                            )
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.luxuryVerb.stereoSpread
                              ? 'bg-amber-400 text-zinc-950 border-amber-300 font-semibold'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          Wide Hall
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam('luxuryVerb', 'power', !params.luxuryVerb.power)
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.luxuryVerb.power
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          {params.luxuryVerb.power ? 'Active' : 'Bypass'}
                        </button>
                      </div>
                    </div>
                    <SliderRow
                      label="Hall Wet Mix"
                      value={params.luxuryVerb.mix}
                      min={0}
                      max={0.85}
                      step={0.02}
                      display={`${Math.round(params.luxuryVerb.mix * 100)}%`}
                      onChange={(v) => onUpdateParam('luxuryVerb', 'mix', v)}
                    />
                    <SliderRow
                      label="Room Decay"
                      value={params.luxuryVerb.decaySec}
                      min={0.5}
                      max={5.5}
                      step={0.1}
                      display={`${params.luxuryVerb.decaySec.toFixed(1)} s`}
                      onChange={(v) => onUpdateParam('luxuryVerb', 'decaySec', v)}
                    />
                    <SliderRow
                      label="Pre-Delay"
                      value={params.luxuryVerb.preDelayMs}
                      min={0}
                      max={100}
                      step={2}
                      display={`${Math.round(params.luxuryVerb.preDelayMs)} ms`}
                      onChange={(v) => onUpdateParam('luxuryVerb', 'preDelayMs', v)}
                    />
                    <SliderRow
                      label="High Shimmer"
                      value={params.luxuryVerb.shimmer}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round(params.luxuryVerb.shimmer * 100)}%`}
                      onChange={(v) => onUpdateParam('luxuryVerb', 'shimmer', v)}
                    />
                  </div>

                  {/* EXC-13 Harmonic Exciter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-orange-300">
                      <span>EXC-13 Harmonic Exciter</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam(
                              'harmonicExciter',
                              'tubeOddEven',
                              !params.harmonicExciter.tubeOddEven
                            )
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.harmonicExciter.tubeOddEven
                              ? 'bg-orange-400 text-zinc-950 border-orange-300 font-semibold'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          {params.harmonicExciter.tubeOddEven ? 'Even Triode' : 'Odd Pentode'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam(
                              'harmonicExciter',
                              'power',
                              !params.harmonicExciter.power
                            )
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.harmonicExciter.power
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          {params.harmonicExciter.power ? 'Active' : 'Bypass'}
                        </button>
                      </div>
                    </div>
                    <SliderRow
                      label="Tune Frequency"
                      value={params.harmonicExciter.tuneHz}
                      min={1500}
                      max={8000}
                      step={50}
                      display={`${Math.round(params.harmonicExciter.tuneHz)} Hz`}
                      onChange={(v) => onUpdateParam('harmonicExciter', 'tuneHz', v)}
                    />
                    <SliderRow
                      label="Harmonics"
                      value={params.harmonicExciter.harmonics}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round(params.harmonicExciter.harmonics * 100)}%`}
                      onChange={(v) => onUpdateParam('harmonicExciter', 'harmonics', v)}
                    />
                    <SliderRow
                      label="Sub Bass Punch"
                      value={params.harmonicExciter.subPunch}
                      min={0}
                      max={1}
                      step={0.02}
                      display={`${Math.round(params.harmonicExciter.subPunch * 100)}%`}
                      onChange={(v) => onUpdateParam('harmonicExciter', 'subPunch', v)}
                    />
                    <SliderRow
                      label="Air Shelf Boost"
                      value={params.harmonicExciter.airGainDb}
                      min={0}
                      max={10}
                      step={0.2}
                      display={`+${params.harmonicExciter.airGainDb.toFixed(1)} dB`}
                      onChange={(v) => onUpdateParam('harmonicExciter', 'airGainDb', v)}
                    />
                  </div>
                </div>

                {/* IMG-14 M/S Imager & FIN-15 Champagne Reference Output */}
                <div className="pt-3 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
                      <span>IMG-14 Mid / Side Stereo Imager</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam('stereoImager', 'msSolo', !params.stereoImager.msSolo)
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.stereoImager.msSolo
                              ? 'bg-sky-400 text-zinc-950 border-sky-300 font-semibold'
                              : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          Side Solo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam('stereoImager', 'power', !params.stereoImager.power)
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.stereoImager.power
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          {params.stereoImager.power ? 'Active' : 'Bypass'}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <SliderRow
                        label="Stereo Width"
                        value={params.stereoImager.width}
                        min={0}
                        max={2}
                        step={0.02}
                        display={`${Math.round(params.stereoImager.width * 100)}%`}
                        onChange={(v) => onUpdateParam('stereoImager', 'width', v)}
                      />
                      <SliderRow
                        label="Mid Gain"
                        value={params.stereoImager.midGainDb}
                        min={-6}
                        max={6}
                        step={0.2}
                        display={`${params.stereoImager.midGainDb >= 0 ? '+' : ''}${params.stereoImager.midGainDb.toFixed(1)} dB`}
                        onChange={(v) => onUpdateParam('stereoImager', 'midGainDb', v)}
                      />
                      <SliderRow
                        label="Side Gain"
                        value={params.stereoImager.sideGainDb}
                        min={-6}
                        max={6}
                        step={0.2}
                        display={`${params.stereoImager.sideGainDb >= 0 ? '+' : ''}${params.stereoImager.sideGainDb.toFixed(1)} dB`}
                        onChange={(v) => onUpdateParam('stereoImager', 'sideGainDb', v)}
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#e8c488]">
                      <span>FIN-15 Champagne Reference Output</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam(
                              'luxuryMaster',
                              'dimSwitch',
                              !params.luxuryMaster.dimSwitch
                            )
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.luxuryMaster.dimSwitch
                              ? 'bg-amber-400 text-zinc-950 border-amber-300 font-semibold'
                              : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          -12dB Dim
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam(
                              'luxuryMaster',
                              'monoCheck',
                              !params.luxuryMaster.monoCheck
                            )
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.luxuryMaster.monoCheck
                              ? 'bg-amber-400 text-zinc-950 border-amber-300 font-semibold'
                              : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          Mono Check
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateParam('luxuryMaster', 'power', !params.luxuryMaster.power)
                          }
                          className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap shrink-0 ${
                            params.luxuryMaster.power
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          {params.luxuryMaster.power ? 'Active' : 'Bypass'}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <SliderRow
                        label="Reference Ceiling"
                        value={params.luxuryMaster.ceilingDb}
                        min={-3}
                        max={0}
                        step={0.1}
                        display={`${params.luxuryMaster.ceilingDb.toFixed(1)} dB`}
                        onChange={(v) => onUpdateParam('luxuryMaster', 'ceilingDb', v)}
                      />
                      <SliderRow
                        label="Analog Velvet Glow"
                        value={params.luxuryMaster.analogGlow}
                        min={0}
                        max={1}
                        step={0.02}
                        display={`${Math.round(params.luxuryMaster.analogGlow * 100)}%`}
                        onChange={(v) => onUpdateParam('luxuryMaster', 'analogGlow', v)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'patchbay' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-zinc-400 mr-1">Templates:</span>
                    {routingTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => onApplyRoutingTemplate(tpl.cables)}
                        className="px-2.5 py-1 text-[11px] bg-zinc-900 border border-zinc-700 hover:border-amber-400 text-zinc-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Rear 3D View: click any cable to unplug · drag jacks to patch
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80">
                  <select
                    aria-label="Source Output Jack"
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value as OutputJackId)}
                    className="px-2.5 py-1.5 text-xs font-mono-tabular bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-md"
                  >
                    {OUTPUT_JACKS.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-zinc-500">→</span>
                  <select
                    aria-label="Destination Input Jack"
                    value={newTo}
                    onChange={(e) => setNewTo(e.target.value as InputJackId)}
                    className="px-2.5 py-1.5 text-xs font-mono-tabular bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-md"
                  >
                    {INPUT_JACKS.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onConnectCable(newFrom, newTo)}
                    className="px-3 py-1.5 text-xs font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Cable className="w-3.5 h-3.5" />
                    <span>Patch Cable</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {cables.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 px-2.5 py-1 bg-zinc-900 border border-zinc-700 rounded-md text-[11px] font-mono-tabular text-zinc-200"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          CABLE_DOT_COLORS[c.tone] || 'bg-amber-500'
                        }`}
                      />
                      <span>
                        {c.from} → {c.to}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveCable(c.id)}
                        className="text-zinc-400 hover:text-white transition-colors"
                        aria-label={`Unplug cable ${c.from} to ${c.to}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[11px]">
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
