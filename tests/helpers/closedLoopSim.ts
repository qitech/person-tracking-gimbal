import { Controller } from '../../src/app/controller';
import { DEFAULT_PID_CONFIG } from '../../src/control/presets';
import type { PidGains } from '../../src/control/pid';
import { SimGimbalDriver } from '../../src/gimbal/simGimbalDriver';

export interface Trace { t: number[]; angle: number[]; target: number[] }

const LIMITS = { panMin: -21, panMax: 21, tiltMin: -12, tiltMax: 12, maxVel: 180, maxAccel: 600 };

/** Pan-only closed loop: controller at detection rate, sim driver in between. */
export function simulate(opts: { gains: PidGains; target: (t: number) => number; durationS: number; detectHz?: number }): Trace {
  const hz = opts.detectHz ?? 30;
  const dt = 1 / hz;
  const driver = new SimGimbalDriver(LIMITS, 0.06);
  const ctrl = new Controller({ ...DEFAULT_PID_CONFIG, ...opts.gains });
  const trace: Trace = { t: [], angle: [], target: [] };
  const noKeys = { left: false, right: false, up: false, down: false };
  for (let t = 0; t <= opts.durationS; t += dt) {
    const gimbal = driver.getState();
    const target = opts.target(t);
    const out = ctrl.step({
      mode: 'auto', dt, gimbal, limits: LIMITS,
      tracker: { state: 'tracking', aim: { x: 0, y: 0 }, targetIndex: 0 },
      targetAngles: { pan: target, tilt: 0 },
      manual: { pan: 0, tilt: 0 }, keys: noKeys,
    });
    driver.setVelocityCommand(out.panVel, out.tiltVel);
    driver.update(dt);
    trace.t.push(t);
    trace.angle.push(driver.getState().pan);
    trace.target.push(target);
  }
  return trace;
}

export function overshoot(tr: Trace, stepSize: number): number {
  return (Math.max(...tr.angle) - stepSize) / stepSize;
}

/** Time after which the angle stays within tol of the final target. */
export function settlingTime(tr: Trace, tolDeg: number): number {
  for (let i = tr.t.length - 1; i >= 0; i--) {
    if (Math.abs(tr.angle[i] - tr.target[i]) > tolDeg) return i + 1 < tr.t.length ? tr.t[i + 1] : Infinity;
  }
  return 0;
}

export function rmsError(tr: Trace, fromS: number): number {
  let sum = 0, n = 0;
  tr.t.forEach((t, i) => { if (t >= fromS) { sum += (tr.angle[i] - tr.target[i]) ** 2; n++; } });
  return Math.sqrt(sum / n);
}
