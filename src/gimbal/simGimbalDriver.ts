import { ServoAxis } from './servoModel';
import type { GimbalDriver, GimbalLimits, GimbalState } from './types';

export const SIM_STEP_S = 0.005;
const MAX_FRAME_DT = 0.25;
const EPS = 1e-12;

/** Simulated pan/tilt platform integrated at a fixed 200 Hz step regardless of frame rate. */
export class SimGimbalDriver implements GimbalDriver {
  private _limits: GimbalLimits;
  private pan: ServoAxis;
  private tilt: ServoAxis;
  private acc = 0;

  constructor(limits: GimbalLimits, delayS: number) {
    this._limits = { ...limits };
    const { maxVel, maxAccel } = limits;
    this.pan = new ServoAxis({ maxVel, maxAccel, delayS, min: limits.panMin, max: limits.panMax });
    this.tilt = new ServoAxis({ maxVel, maxAccel, delayS, min: limits.tiltMin, max: limits.tiltMax });
  }

  get limits(): GimbalLimits { return this._limits; }

  setLimits(l: GimbalLimits): void {
    this._limits = { ...l };
    this.pan.setParams({ maxVel: l.maxVel, maxAccel: l.maxAccel, min: l.panMin, max: l.panMax });
    this.tilt.setParams({ maxVel: l.maxVel, maxAccel: l.maxAccel, min: l.tiltMin, max: l.tiltMax });
  }

  setDelay(delayS: number): void {
    this.pan.setParams({ delayS });
    this.tilt.setParams({ delayS });
  }

  setVelocityCommand(pan: number, tilt: number): void {
    this.pan.command(pan);
    this.tilt.command(tilt);
  }

  getState(): GimbalState {
    return { pan: this.pan.angle, tilt: this.tilt.angle, panVel: this.pan.velocity, tiltVel: this.tilt.velocity };
  }

  update(dtSeconds: number): void {
    if (!(dtSeconds > 0)) return;
    this.acc += Math.min(dtSeconds, MAX_FRAME_DT);
    while (this.acc >= SIM_STEP_S - EPS) {
      this.pan.step(SIM_STEP_S);
      this.tilt.step(SIM_STEP_S);
      this.acc -= SIM_STEP_S;
    }
  }

  home(): void {
    this.pan.reset(0);
    this.tilt.reset(0);
    this.acc = 0;
  }
}
