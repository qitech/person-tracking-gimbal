import type { Point, Rect } from '../types';

/** Where `object-fit: contain` places content of contentW×contentH inside a boxW×boxH box. */
export function containRect(boxW: number, boxH: number, contentW: number, contentH: number): Rect {
  const scale = Math.min(boxW / contentW, boxH / contentH);
  const w = contentW * scale, h = contentH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

/** Client (pointer) coordinates → frame pixels for a contain-fitted element; null on the bars. */
export function clientToFrame(
  p: Point,
  box: { left: number; top: number; width: number; height: number },
  frameW: number,
  frameH: number,
): Point | null {
  const r = containRect(box.width, box.height, frameW, frameH);
  const x = p.x - box.left - r.x, y = p.y - box.top - r.y;
  if (x < 0 || y < 0 || x > r.w || y > r.h) return null;
  return { x: (x / r.w) * frameW, y: (y / r.h) * frameH };
}
