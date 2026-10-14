import { describe, expect, test } from 'vitest';
import { clientToFrame, containRect } from '../src/ui/fit';

describe('containRect', () => {
  test('portrait frame in a wide box is pillarboxed and centred', () => {
    expect(containRect(400, 300, 720, 1280)).toEqual({ x: 115.625, y: 0, w: 168.75, h: 300 });
  });
  test('landscape frame in a tall box is letterboxed', () => {
    expect(containRect(360, 600, 1280, 720)).toEqual({ x: 0, y: 198.75, w: 360, h: 202.5 });
  });
  test('matching aspect fills the box', () => {
    expect(containRect(640, 360, 1280, 720)).toEqual({ x: 0, y: 0, w: 640, h: 360 });
  });
});

describe('clientToFrame', () => {
  const box = { left: 10, top: 20, width: 400, height: 300 };
  test('maps a click inside the content to frame pixels', () => {
    // content spans x 125.625..294.375 in client space (10 + 115.625)
    const p = clientToFrame({ x: 10 + 115.625 + 168.75 / 2, y: 20 + 150 }, box, 720, 1280)!;
    expect(p.x).toBeCloseTo(360, 6);
    expect(p.y).toBeCloseTo(640, 6);
  });
  test('returns null for a click on the bars', () => {
    expect(clientToFrame({ x: 20, y: 100 }, box, 720, 1280)).toBeNull();
  });
});
