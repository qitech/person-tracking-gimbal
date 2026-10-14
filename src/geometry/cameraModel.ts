import type { Point, Rect } from '../types';

export interface CameraModelParams { width: number; height: number; physHfovDeg: number; virtHfovDeg: number }
export interface AngleLimits { panMin: number; panMax: number; tiltMin: number; tiltMax: number }

export interface CameraModel {
  readonly width: number;
  readonly height: number;
  /** Focal length in pixels. */
  readonly f: number;
  /** Virtual camera HFOV after clamping. */
  readonly virtHfovDeg: number;
  pixelToAngle(p: Point): { pan: number; tilt: number };
  angleToPixel(pan: number, tilt: number): Point;
  fovWindow(pan: number, tilt: number): Rect;
  limits(): AngleLimits;
}

const MIN_VIRT_HFOV = 10;
const VIRT_HFOV_MARGIN = 5;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Pinhole model of the fixed laptop camera. The virtual pan/tilt camera is a
 * window inside the full frame; pan/tilt shift the window (no perspective warp).
 */
export function createCameraModel(p: CameraModelParams): CameraModel {
  const { width: W, height: H, physHfovDeg } = p;
  if (!(W > 0) || !(H > 0)) throw new Error(`Invalid frame size ${W}x${H}`);

  const virtHfovDeg = Math.min(Math.max(p.virtHfovDeg, MIN_VIRT_HFOV), physHfovDeg - VIRT_HFOV_MARGIN);
  const f = W / 2 / Math.tan(rad(physHfovDeg) / 2);
  const winW = 2 * f * Math.tan(rad(virtHfovDeg) / 2);
  const winH = (winW * H) / W;
  const panMax = deg(Math.atan((W / 2 - winW / 2) / f));
  const tiltMax = deg(Math.atan((H / 2 - winH / 2) / f));

  const angleToPixel = (pan: number, tilt: number): Point => ({
    x: W / 2 + f * Math.tan(rad(pan)),
    y: H / 2 - f * Math.tan(rad(tilt)),
  });

  return {
    width: W,
    height: H,
    f,
    virtHfovDeg,
    pixelToAngle: ({ x, y }) => ({
      pan: deg(Math.atan((x - W / 2) / f)),
      tilt: -deg(Math.atan((y - H / 2) / f)),
    }),
    angleToPixel,
    fovWindow(pan, tilt) {
      const c = angleToPixel(pan, tilt);
      return { x: c.x - winW / 2, y: c.y - winH / 2, w: winW, h: winH };
    },
    limits: () => ({ panMin: -panMax, panMax, tiltMin: -tiltMax, tiltMax }),
  };
}
