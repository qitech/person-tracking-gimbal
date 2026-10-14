import { pickAim, type AimMode } from '../detection/aimPoint';
import type { Person, Point } from '../types';

export type TrackerStateName = 'searching' | 'tracking' | 'lost' | 'returning';
export interface TrackerConfig { gateFrac: number; lostTimeoutS: number; aimMode: AimMode; smoothingAlpha: number }
export const DEFAULT_TRACKER_CONFIG: TrackerConfig = { gateFrac: 0.15, lostTimeoutS: 1.5, aimMode: 'torso', smoothingAlpha: 0.5 };

/** `aim` is the smoothed aim point of the target, in frame pixels. */
export interface TrackerOutput { state: TrackerStateName; aim: Point | null; targetIndex: number | null }

interface Candidate { index: number; aim: Point }

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function nearest(cands: Candidate[], to: Point, maxDist = Infinity): Candidate | null {
  let best: Candidate | null = null;
  let bestD = maxDist;
  for (const c of cands) {
    const d = dist(c.aim, to);
    if (d <= bestD) { best = c; bestD = d; }
  }
  return best;
}

/** Picks one person and follows them across frames; handles loss, timeout and return-to-home. */
export class TargetTracker {
  private cfg: TrackerConfig;
  private state: TrackerStateName = 'searching';
  private lastRaw: Point | null = null;
  private smoothed: Point | null = null;
  private lostSince = 0;
  private homeReached = false;

  constructor(cfg: Partial<TrackerConfig> = {}) {
    this.cfg = { ...DEFAULT_TRACKER_CONFIG, ...cfg };
  }

  setConfig(cfg: Partial<TrackerConfig>): void {
    this.cfg = { ...this.cfg, ...cfg };
  }

  update(people: Person[], nowS: number, fovCenter: Point, frameWidth: number): TrackerOutput {
    const cands = this.candidates(people);
    const gate = this.cfg.gateFrac * frameWidth;

    switch (this.state) {
      case 'tracking': {
        const m = nearest(cands, this.lastRaw!, gate);
        if (m) return this.follow(m);
        this.state = 'lost';
        this.lostSince = nowS;
        return this.idle();
      }
      case 'lost': {
        const m = nearest(cands, this.lastRaw!, gate);
        if (m) return this.capture(m);
        if (nowS - this.lostSince > this.cfg.lostTimeoutS) {
          this.state = 'returning';
          this.homeReached = false;
        }
        return this.idle();
      }
      case 'returning':
      case 'searching': {
        const m = nearest(cands, fovCenter);
        if (m) return this.capture(m);
        if (this.state === 'returning' && this.homeReached) this.state = 'searching';
        return this.idle();
      }
    }
  }

  selectAt(p: Point, people: Person[], _nowS: number): boolean {
    const hits = this.candidates(people).filter(({ index }) => {
      const b = people[index].bbox;
      return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    });
    const m = nearest(hits, p);
    if (!m) return false;
    this.capture(m);
    return true;
  }

  notifyHomeReached(): void {
    if (this.state === 'returning') this.homeReached = true;
  }

  reset(): void {
    this.state = 'searching';
    this.lastRaw = this.smoothed = null;
    this.homeReached = false;
  }

  private candidates(people: Person[]): Candidate[] {
    const out: Candidate[] = [];
    people.forEach((p, index) => {
      const aim = pickAim(p.aim, this.cfg.aimMode);
      if (aim) out.push({ index, aim });
    });
    return out;
  }

  private capture(c: Candidate): TrackerOutput {
    this.state = 'tracking';
    this.lastRaw = c.aim;
    this.smoothed = { ...c.aim };
    return { state: 'tracking', aim: { ...this.smoothed }, targetIndex: c.index };
  }

  private follow(c: Candidate): TrackerOutput {
    const a = this.cfg.smoothingAlpha;
    const s = this.smoothed!;
    this.lastRaw = c.aim;
    this.smoothed = { x: a * c.aim.x + (1 - a) * s.x, y: a * c.aim.y + (1 - a) * s.y };
    return { state: 'tracking', aim: { ...this.smoothed }, targetIndex: c.index };
  }

  private idle(): TrackerOutput {
    return { state: this.state, aim: null, targetIndex: null };
  }
}
