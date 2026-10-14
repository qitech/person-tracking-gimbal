import { describe, expect, test } from 'vitest';
import { bboxFromKeypoints, computeAim, pickAim } from '../src/detection/aimPoint';
import type { Keypoint } from '../src/types';

const empty = (): Keypoint[] => Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
const with_ = (pts: [number, number, number][]): Keypoint[] => {
  const k = empty();
  for (const [i, x, y] of pts) k[i] = { x, y, visibility: 0.9 };
  return k;
};

describe('computeAim', () => {
  test('torso from shoulders and hips', () => {
    const a = computeAim(with_([[11, 100, 100], [12, 200, 100], [23, 110, 300], [24, 190, 300]]));
    expect(a.torso).toEqual({ x: 150, y: 200 });
  });

  test('torso fallback without hips', () => {
    const a = computeAim(with_([[11, 100, 100], [12, 200, 100]]));
    expect(a.torso).toEqual({ x: 150, y: 125 });
  });

  test('torso with one shoulder and one hip', () => {
    const a = computeAim(with_([[11, 100, 100], [24, 200, 300]]));
    expect(a.torso).toEqual({ x: 150, y: 200 });
  });

  test('no torso without shoulders', () => {
    expect(computeAim(with_([[23, 110, 300], [24, 190, 300]])).torso).toBeNull();
  });

  test('head from nose', () => {
    expect(computeAim(with_([[0, 150, 50], [2, 140, 45], [5, 160, 45]])).head).toEqual({ x: 150, y: 50 });
  });

  test('head from eyes when nose hidden', () => {
    expect(computeAim(with_([[2, 140, 45], [5, 160, 45]])).head).toEqual({ x: 150, y: 45 });
  });

  test('low visibility counts as hidden', () => {
    const k = with_([[11, 100, 100], [12, 200, 100]]);
    k[11].visibility = 0.4;
    k[12].visibility = 0.4;
    expect(computeAim(k).torso).toBeNull();
  });
});

describe('pickAim', () => {
  test('falls back to the other point', () => {
    expect(pickAim({ torso: { x: 1, y: 2 }, head: null }, 'head')).toEqual({ x: 1, y: 2 });
    expect(pickAim({ torso: null, head: { x: 3, y: 4 } }, 'torso')).toEqual({ x: 3, y: 4 });
    expect(pickAim({ torso: null, head: null }, 'head')).toBeNull();
  });
});

describe('bboxFromKeypoints', () => {
  test('uses visible points only', () => {
    const k = with_([[0, 100, 50], [27, 140, 400]]);
    k[5] = { x: 900, y: 900, visibility: 0.1 };
    expect(bboxFromKeypoints(k)).toEqual({ x: 100, y: 50, w: 40, h: 350 });
  });
});
