import { DaemonCategory, EventDaemon, StudioEvent } from '../types/studio';

const CATEGORIES: DaemonCategory[] = [
  'Audio Transient',
  'Silence Condenser',
  'Gain Guard',
  'Cable Physics',
  'Drive Sync',
  'AI Bridge',
];

const EVENT_CHANNELS: Record<DaemonCategory, string[]> = {
  'Audio Transient': ['audio:transient', 'audio:beat_lock'],
  'Silence Condenser': ['audio:silence_gap', 'audio:wave_round'],
  'Gain Guard': ['rack:dial_turn', 'rack:switch_toggle'],
  'Cable Physics': ['cable:patch', 'cable:unpatch'],
  'Drive Sync': ['drive:sync', 'library:read'],
  'AI Bridge': ['ai:directive', 'export:wav'],
};

export class DaemonNetwork {
  public readonly daemons: EventDaemon[];
  private eventLog: StudioEvent[] = [];
  private totalEvents = 0;
  private listeners: Set<() => void> = new Set();
  private automationEnabled = true;
  private autoGainGuard = true;

  constructor() {
    this.daemons = this.spawnDaemons();
  }

  private spawnDaemons(): EventDaemon[] {
    const list: EventDaemon[] = [];
    for (let i = 0; i < 100; i++) {
      const cat = CATEGORIES[i % CATEGORIES.length];
      const channels = EVENT_CHANNELS[cat];
      const subscribedEvent = channels[Math.floor(i / CATEGORIES.length) % channels.length];
      const num = String(i + 1).padStart(3, '0');
      list.push({
        id: `DM-${num}`,
        name: `${cat.replace(/\s+/g, '')}Daemon-${num}`,
        category: cat,
        subscribedEvent,
        executions: 0,
        active: true,
        lastTriggeredAt: null,
      });
    }
    return list;
  }

  public isAutomationEnabled(): boolean {
    return this.automationEnabled;
  }

  public setAutomationEnabled(enabled: boolean) {
    this.automationEnabled = enabled;
    for (const d of this.daemons) {
      d.active = enabled;
    }
    this.notify();
  }

  public isAutoGainGuardEnabled(): boolean {
    return this.autoGainGuard;
  }

  public setAutoGainGuardEnabled(enabled: boolean) {
    this.autoGainGuard = enabled;
    this.notify();
  }

  public emit(type: string, source: string, summary: string) {
    const now = Date.now();
    const matched = this.daemons.filter(
      (d) => d.active && d.subscribedEvent === type
    );

    if (matched.length === 0) return;

    for (const d of matched) {
      d.executions += 1;
      d.lastTriggeredAt = now;
    }
    this.totalEvents += 1;

    const lead = matched[this.totalEvents % matched.length];
    this.eventLog.unshift({
      id: `evt-${now}-${this.totalEvents}`,
      type,
      source,
      daemonId: lead.id,
      summary,
      timestamp: now,
    });

    if (this.eventLog.length > 40) {
      this.eventLog.length = 40;
    }

    this.notify();
  }

  public getEventLog(): StudioEvent[] {
    return this.eventLog;
  }

  public getStats() {
    let activeCount = 0;
    let totalExecutions = 0;
    for (const d of this.daemons) {
      if (d.active) activeCount += 1;
      totalExecutions += d.executions;
    }
    return {
      totalDaemons: this.daemons.length,
      activeCount,
      totalExecutions,
      totalEvents: this.totalEvents,
    };
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    for (const cb of this.listeners) {
      cb();
    }
  }
}
