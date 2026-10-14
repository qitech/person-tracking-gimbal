import { describe, expect, test } from 'vitest';
import { PRESETS } from '../src/control/presets';
import { overshoot, rmsError, settlingTime, simulate } from './helpers/closedLoopSim';

const step10 = (gains = PRESETS.good) => simulate({ gains, target: () => 10, durationS: 5 });

describe('closed loop presets', () => {
  test('good preset: 10° step', () => {
    const tr = step10();
    expect(overshoot(tr, 10)).toBeLessThanOrEqual(0.15);
    expect(settlingTime(tr, 1)).toBeLessThanOrEqual(1);
  });

  test('good preset: sine 10°, 0.2 Hz', () => {
    const tr = simulate({ gains: PRESETS.good, target: (t) => 10 * Math.sin(2 * Math.PI * 0.2 * t), durationS: 10 });
    expect(rmsError(tr, 2)).toBeLessThanOrEqual(2);
  });

  test('oscillating preset: overshoot ≥ 30%', () => {
    expect(overshoot(step10(PRESETS.oscillating), 10)).toBeGreaterThanOrEqual(0.3);
  });

  test('slow preset: settling ≥ 2 s', () => {
    expect(settlingTime(step10(PRESETS.slow), 1)).toBeGreaterThanOrEqual(2);
  });
});

describe('closed loop comes to rest', () => {
  test('good preset: platform stops after a 10° step', () => {
    const tr = simulate({ gains: PRESETS.good, target: () => 10, durationS: 30 });
    const tail = tr.angle.slice(-60); // last 2 s at 30 Hz
    expect(Math.max(...tail) - Math.min(...tail)).toBeLessThan(0.01);
    expect(Math.abs(tail[tail.length - 1] - 10)).toBeLessThanOrEqual(0.7 + 1e-6);
  });
});
