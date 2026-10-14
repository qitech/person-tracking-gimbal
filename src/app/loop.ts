import { PRESETS } from '../control/presets';
import type { PoseDetector } from '../detection/poseDetector';
import { createCameraModel, type CameraModel } from '../geometry/cameraModel';
import { SimGimbalDriver } from '../gimbal/simGimbalDriver';
import type { GimbalLimits } from '../gimbal/types';
import { TargetTracker, type TrackerOutput } from '../tracking/targetTracker';
import type { Person, Point } from '../types';
import { Controller, type ControllerInput } from './controller';
import { DEFAULT_SETTINGS, type AppSettings, type FrameSnapshot } from './state';

export interface App {
  start(): void;
  stop(): void;
  getSettings(): AppSettings;
  updateSettings(p: Partial<AppSettings>): void;
  /** Point in video-frame pixels. */
  selectAt(p: Point): void;
  setKeys(k: ControllerInput['keys']): void;
  onFrame(cb: (s: FrameSnapshot) => void): void;
}

const NO_KEYS = { left: false, right: false, up: false, down: false };
const FPS_ALPHA = 0.1;

export function createApp(deps: { video: HTMLVideoElement; detector: PoseDetector }): App {
  const { video, detector } = deps;
  let settings: AppSettings = structuredClone(DEFAULT_SETTINGS);
  const tracker = new TargetTracker({ aimMode: settings.aimMode, smoothingAlpha: settings.smoothingAlpha });
  const controller = new Controller({ ...settings.pid, outputLimit: settings.servo.maxVel });
  const listeners: ((s: FrameSnapshot) => void)[] = [];

  let model: CameraModel | null = null;
  let modelKey = '';
  let driver: SimGimbalDriver | null = null;
  let limits: GimbalLimits | null = null;
  let keys = NO_KEYS;

  let raf = 0;
  let lastFrameS: number | null = null;
  let lastVideoTime = -1;
  let lastDetectS: number | null = null;
  let lastTimestampMs = 0;
  let nowS = 0;
  let people: Person[] = [];
  let trackerOut: TrackerOutput = { state: 'searching', aim: null, targetIndex: null };
  let targetAngles: { pan: number; tilt: number } | null = null;
  let fps = 0;
  let detectMs = 0;

  function ensureModel(): void {
    const W = video.videoWidth, H = video.videoHeight;
    const key = [W, H, settings.physHfovDeg, settings.virtHfovDeg, settings.servo.maxVel, settings.servo.maxAccel].join('|');
    if (key === modelKey && model) return;
    modelKey = key;
    model = createCameraModel({ width: W, height: H, physHfovDeg: settings.physHfovDeg, virtHfovDeg: settings.virtHfovDeg });
    limits = { ...model.limits(), maxVel: settings.servo.maxVel, maxAccel: settings.servo.maxAccel };
    if (!driver) driver = new SimGimbalDriver(limits, settings.servo.delayS);
    else driver.setLimits(limits);
  }

  function controllerInput(dt: number): ControllerInput {
    return {
      mode: settings.mode, dt, gimbal: driver!.getState(), limits: limits!,
      tracker: trackerOut, targetAngles, manual: settings.manual, keys,
    };
  }

  function detectStep(): void {
    const g = driver!.getState();
    let ts = performance.now();
    if (ts <= lastTimestampMs) ts = lastTimestampMs + 1; // MediaPipe needs strictly increasing timestamps
    lastTimestampMs = ts;
    try {
      people = detector.detect(video, ts);
    } catch (e) {
      console.error('Pose detection failed', e);
      return;
    }
    detectMs = performance.now() - ts;

    const fov = model!.fovWindow(g.pan, g.tilt);
    const center = { x: fov.x + fov.w / 2, y: fov.y + fov.h / 2 };
    trackerOut = tracker.update(people, nowS, center, video.videoWidth);
    targetAngles = trackerOut.aim ? model!.pixelToAngle(trackerOut.aim) : null;

    const detDt = lastDetectS === null ? 0 : nowS - lastDetectS;
    lastDetectS = nowS;
    if (detDt > 0) fps = fps ? fps + FPS_ALPHA * (1 / detDt - fps) : 1 / detDt;

    if (settings.mode === 'auto') {
      const out = controller.step(controllerInput(detDt));
      driver!.setVelocityCommand(out.panVel, out.tiltVel);
      if (out.homeReached) tracker.notifyHomeReached();
    }
  }

  function frame(tMs: number): void {
    raf = requestAnimationFrame(frame);
    nowS = tMs / 1000;
    const dt = lastFrameS === null ? 0 : nowS - lastFrameS;
    lastFrameS = nowS;
    if (!video.videoWidth || !video.videoHeight) return;
    ensureModel();

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      detectStep();
    }
    if (settings.mode === 'manual') {
      const out = controller.step(controllerInput(dt));
      driver!.setVelocityCommand(out.panVel, out.tiltVel);
      // While steering with keys, the slider target follows the platform so it doesn't snap back on release.
      if (keys.left || keys.right || keys.up || keys.down) {
        const g = driver!.getState();
        settings = { ...settings, manual: { pan: g.pan, tilt: g.tilt } };
      }
    }
    driver!.update(dt);

    const g = driver!.getState();
    const snapshot: FrameSnapshot = {
      nowS,
      frameWidth: video.videoWidth,
      frameHeight: video.videoHeight,
      people,
      tracker: trackerOut,
      gimbal: g,
      limits: limits!,
      error: settings.mode === 'auto' && trackerOut.state === 'tracking' && targetAngles
        ? { pan: targetAngles.pan - g.pan, tilt: targetAngles.tilt - g.tilt }
        : null,
      fov: model!.fovWindow(g.pan, g.tilt),
      virtHfovDeg: model!.virtHfovDeg,
      aimMode: settings.aimMode,
      metrics: { fps, detectMs, delegate: detector.delegate },
    };
    for (const l of listeners) l(snapshot);
  }

  return {
    start() {
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      lastFrameS = null;
    },
    getSettings: () => structuredClone(settings),
    updateSettings(p) {
      const prev = settings;
      const next: AppSettings = { ...prev, ...p, pid: { ...prev.pid, ...p.pid }, servo: { ...prev.servo, ...p.servo } };
      if (p.preset && p.preset !== 'custom') {
        next.pid = { ...next.pid, ...PRESETS[p.preset] };
      } else if (p.pid && ['kp', 'ki', 'kd'].some((k) => k in p.pid!)) {
        next.preset = 'custom';
      }
      next.pid.outputLimit = next.servo.maxVel;
      // Entering manual mode keeps the platform where it is instead of snapping to old slider values.
      if (p.mode === 'manual' && prev.mode !== 'manual' && driver) {
        const g = driver.getState();
        next.manual = { pan: g.pan, tilt: g.tilt };
      }
      settings = next;
      controller.setPidConfig(next.pid);
      tracker.setConfig({ aimMode: next.aimMode, smoothingAlpha: next.smoothingAlpha });
      driver?.setDelay(next.servo.delayS);
    },
    selectAt(p) {
      if (settings.mode === 'auto') tracker.selectAt(p, people, nowS);
    },
    setKeys(k) {
      keys = k;
    },
    onFrame(cb) {
      listeners.push(cb);
    },
  };
}
