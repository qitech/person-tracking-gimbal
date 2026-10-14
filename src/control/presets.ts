import type { PidConfig, PidGains } from './pid';

export type PresetName = 'good' | 'slow' | 'oscillating';

export const PRESETS: Record<PresetName, PidGains> = {
  good: { kp: 6, ki: 1, kd: 0.3 },
  slow: { kp: 1, ki: 0, kd: 0 },
  oscillating: { kp: 14, ki: 0, kd: 0 },
};

export const PRESET_LABELS: Record<PresetName, string> = {
  good: 'Добре налаштований',
  slow: 'Повільний',
  oscillating: 'Розгойдується',
};

export const DEFAULT_PID_CONFIG: PidConfig = {
  ...PRESETS.good,
  deadbandDeg: 0.7,
  outputLimit: 180,
  integralLimit: 20,
  derivativeAlpha: 0.3,
};
