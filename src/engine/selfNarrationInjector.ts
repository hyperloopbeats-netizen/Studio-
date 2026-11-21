import { NarrationInjectionStep, RackParameters } from '../types/studio';

export const BASE_INJECTION_SCRIPT: Omit<NarrationInjectionStep, 'status' | 'verifiedAt'>[] = [
  {
    id: 'inj-01',
    phase: 'PHASE 01',
    title: 'AIM Studio Branding & SSL 9000G Console Architecture',
    targetModule: 'StudioRack3D :: sslStudioGroup',
    narration:
      'Self-Narration: Constructing multi-part SSL 9000G analog console behind the Tri-Cabinet mastering gantry at z = -4.20 with 32 instanced EQ/Aux channel strips, motorized faders, center VCA Bus Compressor VU bridge, and backlit AIM marquee.',
    codeSignature: 'injectSslConsole({ channels: 32, brand: "AIM", positionZ: -4.2 })',
  },
  {
    id: 'inj-02',
    phase: 'PHASE 02',
    title: 'Monochrome Neon Black & White Fractal Aperture',
    targetModule: 'StudioRack3D :: fractalPortalGroup',
    narration:
      'Self-Narration: Mounting audio-reactive monochrome GLSL Julia/Mandelbrot fractal shader directly in front of the SSL console (z = -1.95) using additive luminance filaments so the desk remains crisp behind the black void.',
    codeSignature: 'mountMonochromeFractal({ palette: ["#000000", "#ffffff"], reactive: "FFT+Beat" })',
  },
  {
    id: 'inj-03',
    phase: 'PHASE 03',
    title: 'X-Ray See-Through Acoustic Walls & Rear Rack Inspection',
    targetModule: 'StudioRack3D :: roomShellVisibility',
    narration:
      'Self-Narration: Binding camera-angle proximity & manual X-Ray toggle to all acoustic walls, walnut diffuser slats, and abstracted rack chassis shells so orbiting behind any rack renders unobstructed see-through architectural glass.',
    codeSignature: 'enableXRaySeeThrough({ autoBehindRack: true, edgeWireframe: true })',
  },
  {
    id: 'inj-04',
    phase: 'PHASE 04',
    title: 'Sovereign Master Power, Test Tone & Dual Cabling [Tab] Flip',
    targetModule: 'StudioAudioEngine :: masterPower + App :: [Tab]',
    narration:
      'Self-Narration: Wiring Sovereign POWER ON/OFF bus gate, 110Hz sawtooth reference oscillator, and [Tab] key listener synchronized across 3D Front/Rear cameras and Dock Front/Back cabling view.',
    codeSignature: 'bindMasterPowerAndTabFlip({ testOscHz: 110, sync3DCamera: true })',
  },
  {
    id: 'inj-05',
    phase: 'PHASE 05',
    title: 'Drag-and-Drop Reorderable 9-Unit Chain & Per-Unit Bypass',
    targetModule: 'StudioAudioEngine :: rebuildSovereignBus + StudioDock',
    narration:
      'Self-Narration: Injecting live HTML5 DnD modular rack stack (Sub-Bass 808, Tape Sat, Tube Exciter, Transient Punch, SSL VCA Glue, Plate Reverb, Brickwall Limiter, 20Hz-20kHz FFT, Capture) with dynamic Web Audio graph re-ordering and individual BYPASS toggles.',
    codeSignature: 'wireDynamicDspChain({ units: 9, dndReorder: true, perUnitBypass: true })',
  },
  {
    id: 'inj-06',
    phase: 'PHASE 06',
    title: '20Hz-20kHz Live FFT Scope & Dual WAV/.WebM Bus Recorder',
    targetModule: 'StudioAudioEngine :: MediaStreamDestination + StudioDock',
    narration:
      'Self-Narration: Attaching high-resolution canvas FFT spectrum plot and dual capture pipeline (offline 128k WAV renderer + live MediaRecorder .webm master bus capture with running timecode).',
    codeSignature: 'attachFftAndDualRecorder({ formats: ["wav-128k", "audio/webm"] })',
  },
];

export class SelfNarrationInjector {
  private steps: NarrationInjectionStep[] = BASE_INJECTION_SCRIPT.map((s) => ({
    ...s,
    status: 'verified',
    verifiedAt: Date.now(),
  }));

  public getSteps(): NarrationInjectionStep[] {
    return this.steps.map((s) => ({ ...s }));
  }

  public evaluateAgainstState(params: RackParameters, xRayWalls: boolean): NarrationInjectionStep[] {
    const chainCount = params.sovereignChain.order.length;
    const bypassedCount = Object.values(params.sovereignChain.bypass).filter(Boolean).length;
    const activeChainCount = chainCount - bypassedCount;

    return this.steps.map((step) => {
      if (step.id === 'inj-03') {
        return {
          ...step,
          narration: `${BASE_INJECTION_SCRIPT[2].narration} [State: X-Ray ${
            xRayWalls ? 'LOCKED ON' : 'AUTO-BEHIND-RACK'
          }]`,
        };
      }
      if (step.id === 'inj-04') {
        return {
          ...step,
          narration: `${BASE_INJECTION_SCRIPT[3].narration} [State: Master Power ${
            params.masterPower ? 'ON' : 'OFF'
          }]`,
        };
      }
      if (step.id === 'inj-05') {
        return {
          ...step,
          narration: `${BASE_INJECTION_SCRIPT[4].narration} [State: ${activeChainCount}/${chainCount} units active | Order: ${params.sovereignChain.order.slice(0, 4).join(' -> ')}...]`,
        };
      }
      return { ...step };
    });
  }

  public beginSequence(): NarrationInjectionStep[] {
    this.steps = BASE_INJECTION_SCRIPT.map((s, i) => ({
      ...s,
      status: i === 0 ? 'injecting' : 'pending',
      verifiedAt: null,
    }));
    return this.getSteps();
  }

  public advanceStep(index: number): NarrationInjectionStep[] {
    this.steps = this.steps.map((s, idx) => {
      if (idx < index) {
        return { ...s, status: 'verified', verifiedAt: s.verifiedAt ?? Date.now() };
      }
      if (idx === index) {
        return { ...s, status: 'injecting', verifiedAt: null };
      }
      return { ...s, status: 'pending', verifiedAt: null };
    });
    return this.getSteps();
  }

  public completeAll(): NarrationInjectionStep[] {
    const now = Date.now();
    this.steps = BASE_INJECTION_SCRIPT.map((s) => ({
      ...s,
      status: 'verified',
      verifiedAt: now,
    }));
    return this.getSteps();
  }
}
