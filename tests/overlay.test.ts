import { describe, expect, test } from 'vitest';
import type { FrameSnapshot } from '../src/app/state';
import { Overlay } from '../src/ui/overlay';

/** Records 2D context calls so we can check what the overlay paints, in order. */
function recordingCanvas() {
  const calls: { op: string; args: unknown[] }[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (k in t ? t[k as string] : (...args: unknown[]) => { calls.push({ op: String(k), args }); }),
    set: (t, k, v) => { t[k as string] = v; return true; },
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx, addEventListener: () => {} } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

const snap = (): FrameSnapshot => ({
  nowS: 1, frameWidth: 720, frameHeight: 1280, people: [],
  tracker: { state: 'searching', aim: null, targetIndex: null },
  gimbal: { pan: 0, tilt: 0, panVel: 0, tiltVel: 0 },
  limits: { panMin: -10, panMax: 10, tiltMin: -20, tiltMax: 20, maxVel: 180, maxAccel: 600 },
  error: null, fov: { x: 200, y: 400, w: 320, h: 569 }, virtHfovDeg: 35, aimMode: 'torso',
  metrics: { fps: 30, detectMs: 20, delegate: 'GPU' },
});

describe('Overlay', () => {
  // iOS Safari paints a camera <video> out of sync with its CSS box, so the overlay
  // paints the frame itself: image and markings then share one canvas and can't drift.
  test('paints the camera frame first, at full frame size', () => {
    const { canvas, calls } = recordingCanvas();
    const video = { videoWidth: 720, videoHeight: 1280 } as HTMLVideoElement;
    new Overlay(canvas, video, () => {}).render(snap());
    const draws = calls.filter((c) => c.op !== 'clearRect');
    expect(draws[0].op).toBe('drawImage');
    expect(draws[0].args).toEqual([video, 0, 0, 720, 1280]);
    expect([canvas.width, canvas.height]).toEqual([720, 1280]);
  });
});
