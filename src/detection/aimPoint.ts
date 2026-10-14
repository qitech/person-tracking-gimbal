import type { AimPoints, Keypoint, Person, Point, Rect } from '../types';

export type AimMode = 'torso' | 'head';
export const VISIBILITY_THRESHOLD = 0.5;

// MediaPipe pose landmark indices.
const NOSE = 0, LEFT_EYE = 2, RIGHT_EYE = 5;
const SHOULDERS = [11, 12], HIPS = [23, 24];
const SHOULDER_DROP = 0.25; // fraction of shoulder width to move down when hips are hidden

const visible = (kps: Keypoint[], idx: number[]) =>
  idx.map((i) => kps[i]).filter((k) => k && k.visibility >= VISIBILITY_THRESHOLD);

const mean = (pts: Point[]): Point => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

export function computeAim(kps: Keypoint[]): AimPoints {
  const shoulders = visible(kps, SHOULDERS);
  const hips = visible(kps, HIPS);
  let torso: Point | null = null;
  if (shoulders.length) {
    if (hips.length) {
      torso = mean([...shoulders, ...hips]);
    } else {
      const c = mean(shoulders);
      const width = shoulders.length === 2 ? Math.abs(shoulders[0].x - shoulders[1].x) : 0;
      torso = { x: c.x, y: c.y + SHOULDER_DROP * width };
    }
  }

  const nose = visible(kps, [NOSE]);
  const eyes = visible(kps, [LEFT_EYE, RIGHT_EYE]);
  const head = nose.length ? { x: nose[0].x, y: nose[0].y } : eyes.length ? mean(eyes) : null;

  return { torso, head };
}

export function pickAim(aim: AimPoints, mode: AimMode): Point | null {
  return mode === 'head' ? aim.head ?? aim.torso : aim.torso ?? aim.head;
}

export function bboxFromKeypoints(kps: Keypoint[]): Rect {
  const v = kps.filter((k) => k.visibility >= VISIBILITY_THRESHOLD);
  if (!v.length) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = v.map((k) => k.x), ys = v.map((k) => k.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function toPerson(kps: Keypoint[]): Person {
  return { keypoints: kps, bbox: bboxFromKeypoints(kps), aim: computeAim(kps) };
}
