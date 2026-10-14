import type { AimMode } from '../detection/aimPoint';
import type { PidConfig } from '../control/pid';
import { DEFAULT_PID_CONFIG, type PresetName } from '../control/presets';
import type { GimbalLimits, GimbalState } from '../gimbal/types';
import type { TrackerOutput } from '../tracking/targetTracker';
import type { Person, Rect } from '../types';
import type { Mode } from './controller';

export interface AppSettings {
  mode: Mode;
  preset: PresetName | 'custom';
  pid: PidConfig;
  servo: { maxVel: number; maxAccel: number; delayS: number };
  physHfovDeg: number;
  virtHfovDeg: number;
  aimMode: AimMode;
  smoothingAlpha: number;
  presentation: boolean;
  manual: { pan: number; tilt: number };
}

export const DEFAULT_SETTINGS: AppSettings = {
  mode: 'auto',
  preset: 'good',
  pid: { ...DEFAULT_PID_CONFIG },
  servo: { maxVel: 180, maxAccel: 600, delayS: 0.06 },
  physHfovDeg: 70,
  virtHfovDeg: 35,
  aimMode: 'torso',
  smoothingAlpha: 0.5,
  presentation: false,
  manual: { pan: 0, tilt: 0 },
};

export interface FrameSnapshot {
  nowS: number;
  frameWidth: number;
  frameHeight: number;
  people: Person[];
  tracker: TrackerOutput;
  gimbal: GimbalState;
  limits: GimbalLimits;
  error: { pan: number; tilt: number } | null;
  fov: Rect;
  /** Effective (clamped) virtual camera HFOV. */
  virtHfovDeg: number;
  aimMode: AimMode;
  metrics: { fps: number; detectMs: number; delegate: 'GPU' | 'CPU' };
}
