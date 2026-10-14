import { describe, expect, test } from 'vitest';
import { Controller, type ControllerInput } from '../src/app/controller';
import { DEFAULT_PID_CONFIG } from '../src/control/presets';

const limits = { panMin: -21, panMax: 21, tiltMin: -12, tiltMax: 12, maxVel: 180, maxAccel: 600 };
const noKeys = { left: false, right: false, up: false, down: false };
const input = (o: Partial<ControllerInput> = {}): ControllerInput => ({
  mode: 'auto',
  dt: 1 / 30,
  gimbal: { pan: 0, tilt: 0, panVel: 0, tiltVel: 0 },
  limits,
  tracker: { state: 'tracking', aim: { x: 0, y: 0 }, targetIndex: 0 },
  targetAngles: { pan: 0, tilt: 0 },
  manual: { pan: 0, tilt: 0 },
  keys: noKeys,
  ...o,
});

describe('Controller', () => {
  test('auto tracking uses PID', () => {
    const out = new Controller(DEFAULT_PID_CONFIG).step(input({ targetAngles: { pan: 10, tilt: 0 } }));
    expect(out.panVel).toBeGreaterThan(0);
    expect(out.tiltVel).toBe(0);
  });

  test('lost and searching hold position', () => {
    const c = new Controller(DEFAULT_PID_CONFIG);
    for (const state of ['lost', 'searching'] as const) {
      const out = c.step(input({ tracker: { state, aim: null, targetIndex: null }, targetAngles: null }));
      expect(out.panVel).toBe(0);
      expect(out.tiltVel).toBe(0);
    }
  });

  test('lost resets integral', () => {
    const c = new Controller(DEFAULT_PID_CONFIG);
    for (let i = 0; i < 20; i++) c.step(input({ targetAngles: { pan: 5, tilt: 0 }, gimbal: { pan: 0, tilt: 0, panVel: 0, tiltVel: 0 } }));
    c.step(input({ tracker: { state: 'lost', aim: null, targetIndex: null }, targetAngles: null }));
    const after = c.step(input({ targetAngles: { pan: 5, tilt: 0 } }));
    const fresh = new Controller(DEFAULT_PID_CONFIG).step(input({ targetAngles: { pan: 5, tilt: 0 } }));
    expect(after.panVel).toBeCloseTo(fresh.panVel, 9);
  });

  test('returning goes home capped at 30', () => {
    const c = new Controller(DEFAULT_PID_CONFIG);
    const out = c.step(input({
      tracker: { state: 'returning', aim: null, targetIndex: null }, targetAngles: null,
      gimbal: { pan: 15, tilt: -5, panVel: 0, tiltVel: 0 },
    }));
    expect(out.panVel).toBe(-30);
    expect(out.tiltVel).toBeGreaterThan(0);
    expect(out.tiltVel).toBeLessThanOrEqual(30);
    expect(out.homeReached).toBe(false);
    const home = c.step(input({
      tracker: { state: 'returning', aim: null, targetIndex: null }, targetAngles: null,
      gimbal: { pan: 0.2, tilt: -0.3, panVel: 0, tiltVel: 0 },
    }));
    expect(home.homeReached).toBe(true);
  });

  test('manual keys', () => {
    const c = new Controller(DEFAULT_PID_CONFIG);
    expect(c.step(input({ mode: 'manual', keys: { ...noKeys, right: true } })).panVel).toBe(90);
    expect(c.step(input({ mode: 'manual', keys: { ...noKeys, up: true } })).tiltVel).toBeGreaterThan(0);
    expect(c.step(input({ mode: 'manual', keys: { ...noKeys, left: true } })).panVel).toBe(-90);
  });

  test('manual sliders', () => {
    const out = new Controller(DEFAULT_PID_CONFIG).step(input({ mode: 'manual', manual: { pan: 10, tilt: 0 } }));
    expect(out.panVel).toBeGreaterThan(0);
  });

  test('mode switch resets integral', () => {
    const c = new Controller(DEFAULT_PID_CONFIG);
    for (let i = 0; i < 20; i++) c.step(input({ targetAngles: { pan: 5, tilt: 0 } }));
    c.step(input({ mode: 'manual' }));
    const after = c.step(input({ targetAngles: { pan: 5, tilt: 0 } }));
    const fresh = new Controller(DEFAULT_PID_CONFIG).step(input({ targetAngles: { pan: 5, tilt: 0 } }));
    expect(after.panVel).toBeCloseTo(fresh.panVel, 9);
  });
});
