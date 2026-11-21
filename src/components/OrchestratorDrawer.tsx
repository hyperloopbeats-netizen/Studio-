import React, { useMemo, useState } from 'react';
import {
  Activity,
  Cloud,
  Code2,
  Cpu,
  Download,
  FolderSync,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  AiEngineerPassRecord,
  AudioTelemetry,
  DaemonCategory,
  DragonflyArchitect,
  DragonflyDivision,
  EventDaemon,
  NarrationInjectionStep,
  StudioEvent,
  StudioJsonLibrary,
} from '../types/studio';
import { AiSoundEngineerPanel } from './AiSoundEngineerPanel';

type DrawerTab = 'ai' | 'library' | 'daemons' | 'injection';

interface OrchestratorDrawerProps {
  open: boolean;
  onClose: () => void;
  library: StudioJsonLibrary;
  architects: DragonflyArchitect[];
  daemons: EventDaemon[];
  eventLog: StudioEvent[];
  daemonStats: {
    totalDaemons: number;
    activeCount: number;
    totalExecutions: number;
    totalEvents: number;
  };
  automationEnabled: boolean;
  autoGainGuard: boolean;
  onToggleAutomation: (enabled: boolean) => void;
  onToggleAutoGainGuard: (enabled: boolean) => void;
  onLoadPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
  onSaveCurrentAsPreset: (name: string) => void;
  onRecalibrateSwarm: () => void;
  onRunAiDirective: (directive: string) => Promise<void>;
  aiLoading: boolean;
  aiMessage: string | null;
  aiError: string | null;
  // Google Drive Auth & Sync
  isSignedIn: boolean;
  userEmail: string | null;
  driveBusy: boolean;
  driveStatus: string | null;
  onGoogleSignIn: () => void;
  onGoogleLogout: () => void;
  onLoadFromDrive: () => void;
  onSyncToDrive: () => void;
  onDeleteFromDrive: () => void;
  narrationSteps: NarrationInjectionStep[];
  onReplayNarration: () => void;
  telemetryRef: React.MutableRefObject<AudioTelemetry>;
  cablesCount: number;
  aiPassHistory: AiEngineerPassRecord[];
  canUndoAiPass: boolean;
  onUndoAiPass: () => void;
}

export const OrchestratorDrawer: React.FC<OrchestratorDrawerProps> = ({
  open,
  onClose,
  library,
  architects,
  daemons,
  eventLog,
  daemonStats,
  automationEnabled,
  autoGainGuard,
  onToggleAutomation,
  onToggleAutoGainGuard,
  onLoadPreset,
  onDeletePreset,
  onSaveCurrentAsPreset,
  onRecalibrateSwarm,
  onRunAiDirective,
  aiLoading,
  aiMessage,
  aiError,
  isSignedIn,
  userEmail,
  driveBusy,
  driveStatus,
  onGoogleSignIn,
  onGoogleLogout,
  onLoadFromDrive,
  onSyncToDrive,
  onDeleteFromDrive,
  narrationSteps,
  onReplayNarration,
  telemetryRef,
  cablesCount,
  aiPassHistory,
  canUndoAiPass,
  onUndoAiPass,
}) => {
  const [tab, setTab] = useState<DrawerTab>('ai');
  const [newPresetName, setNewPresetName] = useState('');
  const [divisionFilter, setDivisionFilter] = useState<DragonflyDivision | 'All'>('All');
  const [showRawJson, setShowRawJson] = useState(false);
  const [daemonFilter, setDaemonFilter] = useState<DaemonCategory | 'All'>('All');

  const filteredArchitects = useMemo(() => {
    if (divisionFilter === 'All') return architects;
    return architects.filter((a) => a.division === divisionFilter);
  }, [architects, divisionFilter]);

  const filteredDaemons = useMemo(() => {
    if (daemonFilter === 'All') return daemons;
    return daemons.filter((d) => d.category === daemonFilter);
  }, [daemons, daemonFilter]);

  const handleDownloadLibraryJson = () => {
    const blob = new Blob([JSON.stringify(library, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = library.libraryName || 'monolith_studio_library.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  if (!open) return null;

  return (
    <aside className="fixed top-14 right-4 bottom-20 z-30 w-[min(430px,92vw)] bg-[#14161c]/95 border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-[#101217]">
        <span className="text-xs font-semibold text-amber-400 font-display tracking-wide">
          Main AI · Dragonfly Library · 100 Daemons
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-white rounded-md transition-colors"
          aria-label="Close Orchestrator Drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-2 border-b border-zinc-800/80 bg-[#101217]">
        <button
          type="button"
          onClick={() => setTab('ai')}
          className={`py-1.5 px-1.5 text-[11px] font-medium rounded-md flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
            tab === 'ai'
              ? 'bg-amber-500 text-zinc-950 font-semibold'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>Main AI</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('library')}
          className={`py-1.5 px-1.5 text-[11px] font-medium rounded-md flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
            tab === 'library'
              ? 'bg-amber-500 text-zinc-950 font-semibold'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Cloud className="w-3 h-3" />
          <span>Drive JSON</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('daemons')}
          className={`py-1.5 px-1.5 text-[11px] font-medium rounded-md flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
            tab === 'daemons'
              ? 'bg-amber-500 text-zinc-950 font-semibold'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Activity className="w-3 h-3" />
          <span>100 Daemons</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('injection')}
          className={`py-1.5 px-1.5 text-[11px] font-medium rounded-md flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
            tab === 'injection'
              ? 'bg-cyan-400 text-zinc-950 font-semibold'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Code2 className="w-3 h-3" />
          <span>Injection</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-4">
        {tab === 'ai' && (
          <div className="space-y-4">
            <AiSoundEngineerPanel
              compact
              telemetryRef={telemetryRef}
              cablesCount={cablesCount}
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

            {/* 100 Dragonfly Digital Architects Browser */}
            <div className="pt-3 border-t border-zinc-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-zinc-300 font-medium">
                <span>100 Dragonfly Digital Architects</span>
                <button
                  type="button"
                  onClick={onRecalibrateSwarm}
                  className="text-[11px] font-mono-tabular text-zinc-300 hover:text-white flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Re-Index ({library.architectManifest.indexLatencyMs} ms)</span>
                </button>
              </div>

              <select
                aria-label="Filter Dragonfly Architects by Division"
                value={divisionFilter}
                onChange={(e) =>
                  setDivisionFilter(e.target.value as DragonflyDivision | 'All')
                }
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-md"
              >
                <option value="All">All 100 Architects (5 Divisions)</option>
                {Object.keys(library.architectManifest.divisions).map((div) => (
                  <option key={div} value={div}>
                    {div} (20 Architects)
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 gap-1 max-h-44 overflow-y-auto studio-scroll pr-1">
                {filteredArchitects.map((arch) => (
                  <div
                    key={arch.id}
                    className="px-2.5 py-1.5 bg-zinc-900/50 border border-zinc-800/70 rounded text-[10px] font-mono-tabular flex items-center justify-between gap-2"
                  >
                    <span className="text-zinc-200 shrink-0">{arch.id}</span>
                    <span className="text-zinc-400 truncate">{arch.specialization}</span>
                    <span className="text-zinc-500 shrink-0">{arch.weight}w</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'library' && (
          <div className="space-y-4">
            {/* Google Drive Connection & Sync */}
            <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-100">
                  Google Drive JSON Library
                </span>
                <span className="text-[11px] font-mono-tabular text-zinc-400">
                  {library.checksum}
                </span>
              </div>

              {!isSignedIn ? (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-400">
                    Sign in to store and retrieve{' '}
                    <span className="font-mono-tabular text-zinc-200">
                      {library.libraryName}
                    </span>{' '}
                    in your Google Drive.
                  </p>
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    className="gsi-material-button w-full"
                  >
                    <div className="gsi-material-button-state" />
                    <div className="gsi-material-button-content-wrapper">
                      <div className="gsi-material-button-icon">
                        <svg
                          version="1.1"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 48 48"
                          style={{ display: 'block' }}
                        >
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                          />
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          />
                        </svg>
                      </div>
                      <span className="gsi-material-button-contents">
                        Sign in with Google
                      </span>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="truncate">{userEmail}</span>
                    <button
                      type="button"
                      onClick={onGoogleLogout}
                      className="text-zinc-300 hover:text-white underline shrink-0 ml-2"
                    >
                      Sign out
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={driveBusy}
                      onClick={onLoadFromDrive}
                      className="py-2 px-3 text-xs font-medium bg-zinc-950 border border-zinc-700 hover:border-zinc-500 text-zinc-100 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <FolderSync className="w-3.5 h-3.5" />
                      <span>Load from Drive</span>
                    </button>
                    <button
                      type="button"
                      disabled={driveBusy}
                      onClick={onSyncToDrive}
                      className="py-2 px-3 text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Sync to Drive</span>
                    </button>
                  </div>
                  {library.driveSyncMeta.fileId && (
                    <button
                      type="button"
                      disabled={driveBusy}
                      onClick={onDeleteFromDrive}
                      className="w-full py-1.5 px-3 text-[11px] text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 hover:border-zinc-600 rounded-md flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Library File from Drive</span>
                    </button>
                  )}
                </div>
              )}

              {driveStatus && (
                <p className="text-[11px] text-zinc-300 font-mono-tabular">
                  {driveStatus}
                </p>
              )}
            </div>

            {/* Save Current Rack to JSON Library */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="New preset name..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={() => {
                  const clean = newPresetName.trim();
                  if (!clean) return;
                  onSaveCurrentAsPreset(clean);
                  setNewPresetName('');
                }}
                className="px-3 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>

            {/* Indexed Presets from Dragonfly JSON Library */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Indexed Rack Presets ({library.presets.length})</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRawJson((s) => !s)}
                    className="text-[11px] text-zinc-300 hover:text-white underline"
                  >
                    {showRawJson ? 'Hide JSON' : 'Inspect JSON'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadLibraryJson}
                    className="text-[11px] text-zinc-300 hover:text-white flex items-center gap-1"
                    aria-label="Download JSON Library"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {showRawJson && (
                <pre className="p-2.5 bg-black border border-zinc-800 rounded-lg text-[10px] font-mono-tabular text-zinc-300 max-h-44 overflow-auto studio-scroll">
                  {JSON.stringify(library, null, 2)}
                </pre>
              )}

              {library.presets.map((preset) => {
                const isActive = library.activePresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`p-3 rounded-lg border transition-colors space-y-1 ${
                      isActive
                        ? 'bg-zinc-900 border-zinc-400'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onLoadPreset(preset.id)}
                        className="text-left text-xs font-semibold text-zinc-100 hover:underline flex-1 truncate"
                      >
                        {preset.name}
                      </button>
                      <span className="text-[10px] font-mono-tabular text-zinc-400 shrink-0">
                        {preset.cables.length} cables
                      </span>
                      {library.presets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeletePreset(preset.id)}
                          className="text-zinc-500 hover:text-white p-0.5"
                          aria-label={`Delete preset ${preset.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      {preset.description}
                    </p>
                    <div className="text-[10px] font-mono-tabular text-zinc-500">
                      {preset.authorSquad}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'daemons' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-zinc-900/70 border border-zinc-800 rounded-lg">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Real-Time Event Orchestration</span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-zinc-400">
                    {daemonStats.activeCount}/{daemonStats.totalDaemons} Daemons ·{' '}
                    {daemonStats.totalExecutions} Runs
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleAutomation(!automationEnabled)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    automationEnabled
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  {automationEnabled ? 'Active' : 'Paused'}
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-200" />
                  <span>Auto-Gain Headroom Guard</span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleAutoGainGuard(!autoGainGuard)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded border ${
                    autoGainGuard
                      ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                  }`}
                >
                  {autoGainGuard ? 'Armed' : 'Off'}
                </button>
              </div>
            </div>

            {/* Event Stream */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-zinc-300">
                Orchestrated Event Feed
              </div>
              {eventLog.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">
                  Turn a 3D dial, flip a switch, or start audio playback to dispatch daemon events.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {eventLog.slice(0, 12).map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2 bg-zinc-900/60 border border-zinc-800/80 rounded-md text-[11px] space-y-0.5"
                    >
                      <div className="flex items-center justify-between font-mono-tabular text-zinc-300">
                        <span>
                          {ev.daemonId} · {ev.type}
                        </span>
                        <span className="text-zinc-500">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-zinc-400">{ev.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daemon Registry Snapshot */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-300">
                  Daemon Swarm ({filteredDaemons.length})
                </span>
                <select
                  aria-label="Filter Daemons by Category"
                  value={daemonFilter}
                  onChange={(e) =>
                    setDaemonFilter(e.target.value as DaemonCategory | 'All')
                  }
                  className="px-2 py-1 text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-200 rounded"
                >
                  <option value="All">All Categories</option>
                  <option value="Audio Transient">Audio Transient</option>
                  <option value="Silence Condenser">Silence Condenser</option>
                  <option value="Gain Guard">Gain Guard</option>
                  <option value="Cable Physics">Cable Physics</option>
                  <option value="Drive Sync">Drive Sync</option>
                  <option value="AI Bridge">AI Bridge</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto studio-scroll pr-1">
                {filteredDaemons.map((d) => (
                  <div
                    key={d.id}
                    className="px-2 py-1.5 bg-zinc-900/50 border border-zinc-800/70 rounded text-[10px] font-mono-tabular flex items-center justify-between"
                  >
                    <span className="text-zinc-300 truncate">{d.id}</span>
                    <span className="text-zinc-500">{d.executions}×</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'injection' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 p-2.5 bg-zinc-900/70 border border-zinc-800 rounded-lg">
              <div>
                <div className="text-xs font-semibold text-cyan-300">
                  AIM Self-Narration Injection Script
                </div>
                <div className="text-[11px] font-mono-tabular text-zinc-400">
                  {narrationSteps.filter((s) => s.status === 'verified').length}/
                  {narrationSteps.length} Phases Verified
                </div>
              </div>
              <button
                type="button"
                onClick={onReplayNarration}
                className="px-2.5 py-1.5 text-[11px] font-semibold bg-cyan-400 text-zinc-950 hover:bg-cyan-300 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Re-Run Script</span>
              </button>
            </div>

            <div className="space-y-2">
              {narrationSteps.map((step) => (
                <div
                  key={step.id}
                  className={`p-3 rounded-lg border space-y-1.5 transition-colors ${
                    step.status === 'injecting'
                      ? 'bg-cyan-950/30 border-cyan-400'
                      : step.status === 'verified'
                      ? 'bg-zinc-900/70 border-zinc-700'
                      : 'bg-zinc-950 border-zinc-800/70 opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono-tabular text-cyan-300 font-semibold">
                      {step.phase} · {step.targetModule}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-mono-tabular rounded uppercase ${
                        step.status === 'verified'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : step.status === 'injecting'
                          ? 'bg-cyan-400 text-zinc-950 font-semibold'
                          : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-zinc-100">{step.title}</div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">{step.narration}</p>
                  <div className="px-2 py-1 bg-black/70 border border-zinc-800 rounded text-[10px] font-mono-tabular text-amber-300 overflow-x-auto">
                    {step.codeSignature}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
