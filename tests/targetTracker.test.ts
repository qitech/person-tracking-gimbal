import { describe, expect, test } from 'vitest';
import { TargetTracker } from '../src/tracking/targetTracker';
import type { Person } from '../src/types';

const W = 1280;
const C = { x: 640, y: 360 };
const person = (x: number, y: number): Person => ({
  keypoints: [],
  bbox: { x: x - 50, y: y - 150, w: 100, h: 300 },
  aim: { torso: { x, y }, head: { x, y: y - 120 } },
});

describe('TargetTracker', () => {
  test('acquires person nearest FOV centre', () => {
    const t = new TargetTracker();
    const out = t.update([person(300, 360), person(700, 360)], 0, C, W);
    expect(out.state).toBe('tracking');
    expect(out.targetIndex).toBe(1);
  });

  test('keeps target within gate', () => {
    const t = new TargetTracker();
    t.update([person(400, 360)], 0, C, W);
    let out = t.update([person(500, 360), person(640, 360)], 0.033, C, W);
    expect(out.state).toBe('tracking');
    expect(out.targetIndex).toBe(0);
    out = t.update([person(640, 360), person(600, 360)], 0.066, C, W);
    expect(out.targetIndex).toBe(1);
  });

  test('lost when jump exceeds gate', () => {
    const t = new TargetTracker();
    t.update([person(400, 360)], 0, C, W);
    const out = t.update([person(800, 360)], 0.033, C, W);
    expect(out.state).toBe('lost');
    expect(out.aim).toBeNull();
    expect(out.targetIndex).toBeNull();
  });

  test('reacquire within gate while lost', () => {
    const t = new TargetTracker();
    t.update([person(400, 360)], 0, C, W);
    t.update([], 0.033, C, W);
    const out = t.update([person(500, 360)], 0.066, C, W);
    expect(out.state).toBe('tracking');
  });

  test('returning after timeout', () => {
    const t = new TargetTracker();
    t.update([person(400, 360)], 9, C, W);
    expect(t.update([], 10, C, W).state).toBe('lost');
    expect(t.update([], 11.4, C, W).state).toBe('lost');
    expect(t.update([], 11.6, C, W).state).toBe('returning');
  });

  test('returning captures anyone', () => {
    const t = new TargetTracker();
    t.update([person(400, 360)], 0, C, W);
    t.update([], 1, C, W);
    t.update([], 3, C, W);
    const out = t.update([person(1100, 360)], 3.1, C, W);
    expect(out.state).toBe('tracking');
    expect(out.targetIndex).toBe(0);
  });

  test('searching after home', () => {
    const t = new TargetTracker();
    t.update([person(400, 360)], 0, C, W);
    t.update([], 1, C, W);
    t.update([], 3, C, W);
    t.notifyHomeReached();
    expect(t.update([], 3.1, C, W).state).toBe('searching');
  });

  test('notifyHomeReached is ignored outside returning', () => {
    const t = new TargetTracker();
    t.update([person(400, 360)], 0, C, W);
    t.update([], 1, C, W);
    t.notifyHomeReached();
    expect(t.update([], 1.1, C, W).state).toBe('lost');
  });

  test('selectAt', () => {
    const t = new TargetTracker();
    const people = [person(640, 360), person(1000, 360)];
    t.update(people, 0, C, W);
    expect(t.selectAt({ x: 10, y: 10 }, people, 0.01)).toBe(false);
    expect(t.selectAt({ x: 1010, y: 300 }, people, 0.01)).toBe(true);
    const out = t.update(people, 0.033, C, W);
    expect(out.state).toBe('tracking');
    expect(out.targetIndex).toBe(1);
  });

  test('smoothing', () => {
    const t = new TargetTracker({ smoothingAlpha: 0.5 });
    t.update([person(600, 360)], 0, C, W);
    const out = t.update([person(640, 360)], 0.033, C, W);
    expect(out.aim!.x).toBe(620);
  });

  test('aim mode head', () => {
    const t = new TargetTracker({ aimMode: 'head', smoothingAlpha: 1 });
    const out = t.update([person(640, 360)], 0, C, W);
    expect(out.aim).toEqual({ x: 640, y: 240 });
  });

  test('ignores people without aim point', () => {
    const t = new TargetTracker();
    const blind: Person = { keypoints: [], bbox: { x: 0, y: 0, w: 0, h: 0 }, aim: { torso: null, head: null } };
    expect(t.update([blind], 0, C, W).state).toBe('searching');
  });
});
