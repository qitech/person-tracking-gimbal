import { describe, expect, test } from 'vitest';
import { createCameraModel } from '../src/geometry/cameraModel';

const hd = () => createCameraModel({ width: 1280, height: 720, physHfovDeg: 70, virtHfovDeg: 35 });

describe('cameraModel', () => {
  test('f for 1280x720 @70°', () => {
    expect(hd().f).toBeCloseTo(914.01, 1);
  });

  test('pixel/angle round trip', () => {
    const m = hd();
    for (const p of [{ x: 0, y: 0 }, { x: 1280, y: 720 }, { x: 400, y: 500 }]) {
      const a = m.pixelToAngle(p);
      const back = m.angleToPixel(a.pan, a.tilt);
      expect(back.x).toBeCloseTo(p.x, 6);
      expect(back.y).toBeCloseTo(p.y, 6);
    }
  });

  test('centre is zero, right and up are positive', () => {
    const m = hd();
    const c = m.pixelToAngle({ x: 640, y: 360 });
    expect(c.pan).toBeCloseTo(0, 9);
    expect(c.tilt).toBeCloseTo(0, 9);
    const ru = m.pixelToAngle({ x: 900, y: 100 });
    expect(ru.pan).toBeGreaterThan(0);
    expect(ru.tilt).toBeGreaterThan(0);
  });

  test('limits for 16:9', () => {
    const l = hd().limits();
    expect(l.panMax).toBeCloseTo(21.052, 2);
    expect(l.tiltMax).toBeCloseTo(12.217, 2);
    expect(l.panMin).toBe(-l.panMax);
    expect(l.tiltMin).toBe(-l.tiltMax);
  });

  test('limits for 4:3', () => {
    const l = createCameraModel({ width: 640, height: 480, physHfovDeg: 70, virtHfovDeg: 35 }).limits();
    expect(l.panMax).toBeCloseTo(21.052, 2);
    expect(l.tiltMax).toBeCloseTo(16.102, 2);
  });

  test('window stays inside frame at limits', () => {
    const m = hd();
    const l = m.limits();
    const eps = 1e-6;
    for (const pan of [l.panMin, l.panMax]) {
      for (const tilt of [l.tiltMin, l.tiltMax]) {
        const r = m.fovWindow(pan, tilt);
        expect(r.x).toBeGreaterThanOrEqual(-eps);
        expect(r.y).toBeGreaterThanOrEqual(-eps);
        expect(r.x + r.w).toBeLessThanOrEqual(1280 + eps);
        expect(r.y + r.h).toBeLessThanOrEqual(720 + eps);
        expect(r.w).toBeCloseTo(576.4, 1);
        expect(r.h).toBeCloseTo(324.2, 1);
      }
    }
  });

  test('clamps virtHfov', () => {
    const wide = createCameraModel({ width: 1280, height: 720, physHfovDeg: 70, virtHfovDeg: 80 });
    expect(wide.virtHfovDeg).toBe(65);
    expect(wide.limits().panMax).toBeGreaterThan(0);
    const narrow = createCameraModel({ width: 1280, height: 720, physHfovDeg: 70, virtHfovDeg: 2 });
    expect(narrow.virtHfovDeg).toBe(10);
  });

  test('throws on zero size', () => {
    expect(() => createCameraModel({ width: 0, height: 720, physHfovDeg: 70, virtHfovDeg: 35 })).toThrow();
  });
});
