import { Pid, type PidConfig } from '../control/pid';
import { velocityTowards } from '../control/positionHold';
import type { GimbalLimits, GimbalState } from '../gimbal/types';
import type { TrackerOutput } from '../tracking/targetTracker';

export type Mode = 'auto' | 'manual';
export const RETURN_SPEED = 30;
export const HOME_EPS_DEG = 0.5;
const POSITION_GAIN = 4;
const KEY_SPEED_FRACTION = 0.5;

export interface ControllerInput {
  mode: Mode;
  dt: number;
  gimbal: GimbalState;
  limits: GimbalLimits;
  tracker: TrackerOutput;
  /** Angles of tracker.aim in the full frame. */
  targetAngles: { pan: number; tilt: number } | null;
  /** Slider targets in manual mode. */
  manual: { pan: number; tilt: number };
  keys: { left: boolean; right: boolean; up: boolean; down: boolean };
}

export interface ControllerOutput { panVel: number; tiltVel: number; homeReached: boolean }

/** Chooses the velocity command from mode and tracker state. */
export class Controller {
  private pan: Pid;
  private tilt: Pid;
  private wasTracking = false;

  constructor(pid: PidConfig) {
    this.pan = new Pid(pid);
    this.tilt = new Pid(pid);
  }

  setPidConfig(cfg: Partial<PidConfig>): void {
    this.pan.setConfig(cfg);
    this.tilt.setConfig(cfg);
  }

  step(inp: ControllerInput): ControllerOutput {
    const { gimbal: g, limits } = inp;
    const tracking = inp.mode === 'auto' && inp.tracker.state === 'tracking' && inp.targetAngles !== null;
    // Any interruption of auto tracking (mode switch, loss, return) restarts the PIDs.
    if (!tracking && this.wasTracking) this.resetPids();
    this.wasTracking = tracking;

    if (inp.mode === 'manual') {
      const k = inp.keys;
      const keyVel = KEY_SPEED_FRACTION * limits.maxVel;
      const panKeys = Number(k.right) - Number(k.left);
      const tiltKeys = Number(k.up) - Number(k.down);
      return {
        panVel: panKeys ? panKeys * keyVel : velocityTowards(inp.manual.pan, g.pan, POSITION_GAIN, limits.maxVel),
        tiltVel: tiltKeys ? tiltKeys * keyVel : velocityTowards(inp.manual.tilt, g.tilt, POSITION_GAIN, limits.maxVel),
        homeReached: false,
      };
    }

    if (tracking) {
      return {
        panVel: this.pan.update(inp.targetAngles!.pan, g.pan, inp.dt),
        tiltVel: this.tilt.update(inp.targetAngles!.tilt, g.tilt, inp.dt),
        homeReached: false,
      };
    }

    if (inp.tracker.state === 'returning') {
      return {
        panVel: velocityTowards(0, g.pan, POSITION_GAIN, RETURN_SPEED),
        tiltVel: velocityTowards(0, g.tilt, POSITION_GAIN, RETURN_SPEED),
        homeReached: Math.abs(g.pan) < HOME_EPS_DEG && Math.abs(g.tilt) < HOME_EPS_DEG,
      };
    }

    return { panVel: 0, tiltVel: 0, homeReached: false };
  }

  private resetPids(): void {
    this.pan.reset();
    this.tilt.reset();
  }
}
