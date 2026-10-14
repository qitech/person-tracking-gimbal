import { createApp, type App } from './app/loop';
import type { TrackerStateName } from './tracking/targetTracker';
import { CameraError, startCamera } from './camera/camera';
import { PoseDetector } from './detection/poseDetector';
import { Charts } from './ui/charts';
import { Controls } from './ui/controls';
import { Gimbal3D } from './ui/gimbal3d';
import { Overlay } from './ui/overlay';
import { StatusOverlay, type StatusKind } from './ui/status';
import { STATE_LABELS, VirtualView } from './ui/virtualView';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const NO_PERSON_DELAY_S = 1;

function isSupported(): boolean {
  if (!navigator.mediaDevices?.getUserMedia || typeof WebAssembly !== 'object') return false;
  const c = document.createElement('canvas');
  return !!(c.getContext('webgl2') || c.getContext('webgl'));
}

const cameraStatus = (e: unknown): StatusKind => {
  if (!(e instanceof CameraError)) return 'error';
  return ({ denied: 'cameraDenied', notFound: 'cameraNotFound', busy: 'cameraBusy', unsupported: 'unsupported', other: 'error' } as const)[e.kind];
};

function startVideo(video: HTMLVideoElement): Promise<void> {
  if (import.meta.env.DEV && location.search.includes('fake')) {
    return import('./camera/fakeCamera').then((m) => m.startFakeCamera(video));
  }
  return startCamera(video);
}

function bindKeyboard(app: App): void {
  const keys = { left: false, right: false, up: false, down: false };
  const map: Record<string, keyof typeof keys> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  const handle = (down: boolean) => (e: KeyboardEvent) => {
    if (e.key === 'Escape' && down) {
      document.body.classList.remove('presentation');
      return;
    }
    const k = map[e.key];
    const t = e.target as HTMLElement;
    if (!k || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
    if (app.getSettings().mode === 'manual') e.preventDefault();
    keys[k] = down;
    app.setKeys({ ...keys });
  };
  window.addEventListener('keydown', handle(true));
  window.addEventListener('keyup', handle(false));
  window.addEventListener('blur', () => {
    keys.left = keys.right = keys.up = keys.down = false;
    app.setKeys({ ...keys });
  });
}

async function main() {
  const video = $<HTMLVideoElement>('#video');
  let retryCamera: () => void = () => {};
  const status = new StatusOverlay($('#status'), $('#hint'), () => retryCamera());

  if (!isSupported()) {
    status.show('unsupported');
    return;
  }

  status.show('loading', 0);
  const cameraPromise = startVideo(video);
  cameraPromise.catch(() => {}); // handled below, after the model finishes loading
  const detector = await PoseDetector.create({
    wasmBase: './wasm',
    modelUrl: './models/pose_landmarker_lite.task',
    onProgress: (f) => status.show('loading', f),
  });

  // Keep asking for the camera until it works; the retry button re-requests it.
  let cameraLost = false;
  const acquireCamera = async (first: Promise<void>): Promise<boolean> => {
    let attempt = first;
    for (;;) {
      try {
        await attempt;
        break;
      } catch (e) {
        console.error(e);
        const kind = cameraStatus(e);
        status.show(kind);
        if (kind !== 'cameraDenied' && kind !== 'cameraNotFound' && kind !== 'cameraBusy') return false;
        await new Promise<void>((resolve) => { retryCamera = resolve; });
        attempt = startVideo(video);
      }
    }
    // Camera unplugged or permission revoked mid-run: the loop's watchdog holds the platform,
    // and the user gets the same retry screen as at start-up.
    const track = (video.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
    track?.addEventListener('ended', () => {
      cameraLost = true;
      status.show('cameraNotFound');
      retryCamera = () => {
        acquireCamera(startVideo(video)).then((ok) => { if (ok) cameraLost = false; });
      };
    });
    status.show('none');
    return true;
  };
  if (!(await acquireCamera(cameraPromise))) return;

  const app = createApp({ video, detector });
  const overlay = new Overlay($<HTMLCanvasElement>('#overlay'), video, (p) => app.selectAt(p));
  const virtualView = new VirtualView($<HTMLCanvasElement>('#virtual'), video);
  const gimbal3d = new Gimbal3D($('#gimbal3d'));
  const charts = new Charts($('#charts'));
  const controls = new Controls($('#controls'), app);
  const metrics = $('#metrics');
  const stages = [$('#full'), $('#virtual-stage')];
  bindKeyboard(app);

  $('#presentation-toggle').addEventListener('click', () => {
    document.body.classList.toggle('presentation');
    app.updateSettings({ presentation: document.body.classList.contains('presentation') });
  });

  let lastSeenS = 0;
  let lastMetricsS = 0;
  app.onFrame((s) => {
    const ratio = `${s.frameWidth} / ${s.frameHeight}`;
    for (const st of stages) if (st.style.aspectRatio !== ratio) st.style.aspectRatio = ratio;
    const mode = app.getSettings().mode;
    overlay.render(s);
    virtualView.render(s, mode);
    gimbal3d.render(s);
    charts.push(s);
    controls.render(s);

    if (!lastSeenS || s.people.length) lastSeenS = s.nowS;
    if (!cameraLost) status.show(s.nowS - lastSeenS > NO_PERSON_DELAY_S ? 'noPerson' : 'none');

    if (s.nowS - lastMetricsS > 0.25) {
      lastMetricsS = s.nowS;
      const state: TrackerStateName | 'manual' = mode === 'manual' ? 'manual' : s.tracker.state;
      metrics.innerHTML =
        `<span>FPS <b>${s.metrics.fps.toFixed(0)}</b></span>` +
        `<span>детекція <b>${s.metrics.detectMs.toFixed(0)} мс</b></span>` +
        `<span><b>${s.metrics.delegate}</b></span>` +
        `<span>стан <b>${STATE_LABELS[state]}</b></span>`;
    }
  });
  app.start();
  if (import.meta.env.DEV) (window as unknown as { app: App }).app = app;
}

main().catch((e) => {
  console.error(e);
  new StatusOverlay($('#status'), $('#hint'), () => location.reload()).show('error');
});
