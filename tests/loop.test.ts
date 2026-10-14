import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../src/app/loop';
import type { FrameSnapshot } from '../src/app/state';
import type { PoseDetector } from '../src/detection/poseDetector';
import type { Person } from '../src/types';

const person = (x: number, y: number): Person => ({
  keypoints: [],
  bbox: { x: x - 50, y: y - 150, w: 100, h: 300 },
  aim: { torso: { x, y }, head: null },
});

let rafCb: ((t: number) => void) | null = null;
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { rafCb = cb; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => { rafCb = null; });
});
afterEach(() => vi.unstubAllGlobals());

function setup(detect: () => Person[]) {
  const video = { videoWidth: 1280, videoHeight: 720, currentTime: 0 } as unknown as HTMLVideoElement & { currentTime: number };
  const detector = { delegate: 'CPU', detect } as unknown as PoseDetector;
  const app = createApp({ video, detector });
  // Slow servo so a stale command and a watchdog stop end up far apart (21° stop vs ~10°).
  app.updateSettings({ servo: { maxVel: 30, maxAccel: 600, delayS: 0.06 } });
  let last: FrameSnapshot | null = null;
  app.onFrame((s) => { last = s; });
  app.start();
  let t = 0;
  const run = (seconds: number, newFrames: boolean) => {
    for (let i = 0; i < seconds * 60; i++) {
      t += 1000 / 60;
      if (newFrames && i % 2 === 0) video.currentTime += 1 / 30;
      rafCb!(t);
    }
  };
  return { app, run, last: () => last! };
}

describe('loop watchdog', () => {
  test('stops the platform when video frames stop arriving', () => {
    const s = setup(() => [person(800, 360)]); // target ≈ 9.9° pan
    s.run(0.15, true);
    expect(Math.abs(s.last().gimbal.panVel)).toBeGreaterThan(1);
    s.run(1, false);
    // Without a watchdog the stale command drives the platform into its 21.05° stop.
    expect(s.last().gimbal.pan).toBeLessThan(15);
    expect(s.last().gimbal.panVel).toBe(0);
  });

  test('stops the platform when detection keeps failing', () => {
    let fail = false;
    const s = setup(() => { if (fail) throw new Error('boom'); return [person(800, 360)]; });
    s.run(0.15, true);
    expect(Math.abs(s.last().gimbal.panVel)).toBeGreaterThan(1);
    fail = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    s.run(1, true);
    expect(s.last().gimbal.pan).toBeLessThan(15);
    expect(s.last().gimbal.panVel).toBe(0);
  });
});
