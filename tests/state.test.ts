import { expect, test } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/app/state';

test('aims at the head by default', () => {
  expect(DEFAULT_SETTINGS.aimMode).toBe('head');
});
