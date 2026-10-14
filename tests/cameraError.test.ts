import { describe, expect, test } from 'vitest';
import { classifyCameraError } from '../src/camera/camera';

const domErr = (name: string) => Object.assign(new Error(name), { name });

describe('classifyCameraError', () => {
  test('maps getUserMedia errors to kinds', () => {
    expect(classifyCameraError(domErr('NotAllowedError'))).toBe('denied');
    expect(classifyCameraError(domErr('SecurityError'))).toBe('denied');
    expect(classifyCameraError(domErr('NotFoundError'))).toBe('notFound');
    expect(classifyCameraError(domErr('OverconstrainedError'))).toBe('notFound');
    expect(classifyCameraError(domErr('NotReadableError'))).toBe('busy');
    expect(classifyCameraError(domErr('AbortError'))).toBe('busy');
    expect(classifyCameraError(domErr('TypeError'))).toBe('other');
  });
});
