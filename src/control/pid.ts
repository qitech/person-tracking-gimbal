export interface PidGains { kp: number; ki: number; kd: number }
export interface PidConfig extends PidGains {
  deadbandDeg: number;
  outputLimit: number;
  integralLimit: number;
  /** 0..1, EMA factor for the derivative (1 = no smoothing). */
  derivativeAlpha: number;
}

const MAX_DT = 0.1;

const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));

/** Single-axis PID producing an angular-velocity command (deg/s). */
export class Pid {
  private cfg: PidConfig;
  private i = 0;
  private dFiltered = 0;
  private prevMeasurement: number | null = null;
  private lastOutput = 0;

  constructor(cfg: PidConfig) {
    this.cfg = { ...cfg };
  }

  get integral(): number {
    return this.i;
  }

  setConfig(cfg: Partial<PidConfig>): void {
    this.cfg = { ...this.cfg, ...cfg };
    this.i = clamp(this.i, this.cfg.integralLimit);
  }

  update(setpoint: number, measurement: number, dt: number): number {
    if (!(dt > 0)) return this.lastOutput;
    dt = Math.min(dt, MAX_DT);
    const { kp, ki, kd, deadbandDeg, outputLimit, integralLimit, derivativeAlpha } = this.cfg;

    const rawError = setpoint - measurement;
    const error = Math.abs(rawError) < deadbandDeg ? 0 : rawError;

    // Derivative on measurement avoids a kick when the setpoint jumps.
    if (this.prevMeasurement !== null) {
      const dMeas = (measurement - this.prevMeasurement) / dt;
      this.dFiltered = derivativeAlpha * dMeas + (1 - derivativeAlpha) * this.dFiltered;
    }
    this.prevMeasurement = measurement;
    const d = -kd * this.dFiltered;
    const p = kp * error;

    // Conditional integration: skip when it would push further into saturation.
    const candidate = clamp(this.i + error * dt, integralLimit);
    const unclamped = p + ki * candidate + d;
    const saturated = Math.abs(unclamped) > outputLimit && Math.sign(unclamped) === Math.sign(error);
    if (!saturated) this.i = candidate;

    this.lastOutput = clamp(p + ki * this.i + d, outputLimit);
    return this.lastOutput;
  }

  reset(): void {
    this.i = 0;
    this.dFiltered = 0;
    this.prevMeasurement = null;
    this.lastOutput = 0;
  }
}
