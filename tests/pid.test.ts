import { describe, expect, test } from 'vitest';
import { Pid, type PidConfig } from '../src/control/pid';
import { velocityTowards } from '../src/control/positionHold';

const base: PidConfig = {
  kp: 2, ki: 0, kd: 0, deadbandDeg: 0.7, outputLimit: 100, integralLimit: 20, derivativeAlpha: 1,
};
const pid = (o: Partial<PidConfig> = {}) => new Pid({ ...base, ...o });

describe('Pid', () => {
  test('proportional', () => {
    expect(pid().update(10, 0, 0.033)).toBeCloseTo(20, 9);
  });

  test('deadband', () => {
    expect(pid().update(0.5, 0, 0.033)).toBe(0);
    expect(pid().update(-0.6, 0, 0.033)).toBe(0);
  });

  test('output limit', () => {
    expect(pid({ kp: 50 }).update(10, 0, 0.033)).toBe(100);
  });

  test('anti-windup', () => {
    const c = pid({ kp: 50, ki: 5 });
    for (let i = 0; i < 100; i++) c.update(10, 0, 0.033);
    expect(Math.abs(c.integral)).toBeLessThanOrEqual(20);
    const out = c.update(0, 0, 0.033);
    expect(Math.abs(out)).toBeLessThanOrEqual(1e-9 + 5 * 20);
    // Integration was blocked while saturated, so nothing has accumulated.
    expect(c.integral).toBeCloseTo(0, 9);
  });

  test('derivative on measurement', () => {
    const c = pid({ kp: 0, kd: 1 });
    c.update(5, 0, 0.1);
    expect(c.update(5, 1, 0.1)).toBeCloseTo(-10, 9);
    const s = pid({ kp: 0, kd: 1 });
    s.update(0, 0, 0.1);
    expect(s.update(50, 0, 0.1)).toBe(0);
  });

  test('dt <= 0 returns previous output', () => {
    const c = pid();
    expect(c.update(10, 0, 0.033)).toBeCloseTo(20, 9);
    const out = c.update(30, 0, 0);
    expect(out).toBeCloseTo(20, 9);
    expect(Number.isNaN(c.update(30, 0, -1))).toBe(false);
  });

  test('clamps dt', () => {
    const a = pid({ ki: 1 });
    a.update(10, 0, 5);
    const b = pid({ ki: 1 });
    b.update(10, 0, 0.1);
    expect(a.integral).toBeCloseTo(b.integral, 9);
  });

  test('reset', () => {
    const c = pid({ ki: 1, kd: 1, kp: 0 });
    c.update(10, 0, 0.1);
    c.update(10, 5, 0.1);
    c.reset();
    expect(c.integral).toBe(0);
    // First update after reset has no derivative kick from the old measurement.
    expect(c.update(5, 5, 0.1)).toBe(0);
  });
});

describe('velocityTowards', () => {
  test('saturates, scales and stops', () => {
    expect(velocityTowards(10, 0, 4, 30)).toBe(30);
    expect(velocityTowards(1, 0, 4, 30)).toBe(4);
    expect(velocityTowards(0, 0, 4, 30)).toBe(0);
    expect(velocityTowards(-10, 0, 4, 30)).toBe(-30);
  });
});

describe('Pid deadband with integral', () => {
  test('inside deadband the integral does not drive the output', () => {
    const c = new Pid({ ...base, kp: 1, ki: 1 });
    for (let i = 0; i < 10; i++) c.update(5, 0, 0.1); // build up integral
    expect(c.integral).toBeGreaterThan(0);
    const held = c.integral;
    expect(c.update(5, 4.6, 0.1)).toBe(0); // error 0.4 < deadband, measurement unchanged next call
    expect(c.update(5, 4.6, 0.1)).toBe(0);
    expect(c.integral).toBe(held);
  });
});
