import { describe, expect, test } from 'vitest';
import { ServoAxis, type ServoParams } from '../src/gimbal/servoModel';
import { SIM_STEP_S, SimGimbalDriver } from '../src/gimbal/simGimbalDriver';
import type { GimbalLimits } from '../src/gimbal/types';

const params: ServoParams = { maxVel: 180, maxAccel: 600, delayS: 0.06, min: -20, max: 20 };
const steps = (a: ServoAxis, n: number) => { for (let i = 0; i < n; i++) a.step(SIM_STEP_S); };
const limits: GimbalLimits = { panMin: -20, panMax: 20, tiltMin: -12, tiltMax: 12, maxVel: 180, maxAccel: 600 };

describe('ServoAxis', () => {
  test('delay', () => {
    const a = new ServoAxis(params);
    a.command(100);
    steps(a, 11);
    expect(a.velocity).toBe(0);
    steps(a, 2);
    expect(a.velocity).toBeGreaterThan(0);
  });

  test('acceleration limit', () => {
    const a = new ServoAxis({ ...params, delayS: 0 });
    a.command(180);
    steps(a, 20); // 0.1 s
    expect(a.velocity).toBeLessThanOrEqual(60 + 1e-9);
  });

  test('velocity limit', () => {
    const a = new ServoAxis({ ...params, delayS: 0, min: -1000, max: 1000 });
    a.command(1000);
    steps(a, 400);
    expect(a.velocity).toBeLessThanOrEqual(180);
    expect(a.velocity).toBeCloseTo(180, 6);
  });

  test('angle limits', () => {
    const a = new ServoAxis(params);
    a.command(180);
    steps(a, 400);
    expect(a.angle).toBe(20);
    expect(a.velocity).toBe(0);
    a.command(-180);
    steps(a, 40);
    expect(a.angle).toBeLessThan(20);
  });
});

describe('SimGimbalDriver', () => {
  test('driver fixed step', () => {
    const a = new SimGimbalDriver(limits, 0.06);
    const b = new SimGimbalDriver(limits, 0.06);
    a.setVelocityCommand(100, -50);
    b.setVelocityCommand(100, -50);
    for (let i = 0; i < 8; i++) { a.update(0.0125); a.update(0.0125); a.update(0.0125); b.update(0.0375); }
    expect(a.getState()).toEqual(b.getState());
  });

  test('update clamps large dt', () => {
    const d = new SimGimbalDriver(limits, 0.06);
    d.setVelocityCommand(100, 0);
    d.update(30);
    expect(d.getState().pan).toBeLessThanOrEqual(25);
    expect(d.getState().pan).toBeGreaterThan(0);
  });

  test('home', () => {
    const d = new SimGimbalDriver(limits, 0);
    d.setVelocityCommand(100, 100);
    d.update(0.2);
    d.home();
    expect(d.getState()).toEqual({ pan: 0, tilt: 0, panVel: 0, tiltVel: 0 });
  });

  test('setLimits clamps', () => {
    const d = new SimGimbalDriver(limits, 0);
    d.setVelocityCommand(180, 0);
    d.update(0.25); d.update(0.25); d.update(0.25);
    expect(d.getState().pan).toBe(20);
    d.setLimits({ ...limits, panMax: 10 });
    expect(d.getState().pan).toBe(10);
  });

  test('ignores non-positive dt', () => {
    const d = new SimGimbalDriver(limits, 0);
    d.setVelocityCommand(100, 0);
    d.update(0);
    d.update(-1);
    expect(d.getState().pan).toBe(0);
  });
});
