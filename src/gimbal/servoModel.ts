export interface ServoParams { maxVel: number; maxAccel: number; delayS: number; min: number; max: number }

const EPS = 1e-9;

/** One servo axis driven by velocity commands: transport delay, accel/vel limits, hard stops. */
export class ServoAxis {
  private p: ServoParams;
  private now = 0;
  private queue: { t: number; vel: number }[] = [];
  private cmd = 0;
  private _angle = 0;
  private _velocity = 0;

  constructor(p: ServoParams) {
    this.p = { ...p };
  }

  get angle(): number { return this._angle; }
  get velocity(): number { return this._velocity; }

  setParams(p: Partial<ServoParams>): void {
    this.p = { ...this.p, ...p };
    this._angle = Math.min(this.p.max, Math.max(this.p.min, this._angle));
  }

  command(vel: number): void {
    this.queue.push({ t: this.now, vel });
  }

  step(dt: number): void {
    this.now += dt;
    while (this.queue.length && this.queue[0].t + this.p.delayS <= this.now + EPS) {
      this.cmd = this.queue.shift()!.vel;
    }
    const { maxVel, maxAccel, min, max } = this.p;
    const target = Math.max(-maxVel, Math.min(maxVel, this.cmd));
    const dv = Math.max(-maxAccel * dt, Math.min(maxAccel * dt, target - this._velocity));
    this._velocity += dv;
    this._angle += this._velocity * dt;
    if (this._angle >= max) {
      this._angle = max;
      if (this._velocity > 0) this._velocity = 0;
    } else if (this._angle <= min) {
      this._angle = min;
      if (this._velocity < 0) this._velocity = 0;
    }
  }

  reset(angle = 0): void {
    this.queue = [];
    this.cmd = 0;
    this._velocity = 0;
    this._angle = angle;
  }
}
