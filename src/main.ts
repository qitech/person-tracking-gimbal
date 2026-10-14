import { startCamera } from './camera/camera';
import { createApp } from './app/loop';
import { PoseDetector } from './detection/poseDetector';
import { Overlay } from './ui/overlay';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

async function main() {
  const video = $<HTMLVideoElement>('#video');
  const [detector] = await Promise.all([
    PoseDetector.create({ wasmBase: './wasm', modelUrl: './models/pose_landmarker_lite.task' }),
    startCamera(video),
  ]);
  const app = createApp({ video, detector });
  const overlay = new Overlay($<HTMLCanvasElement>('#overlay'), video, (p) => app.selectAt(p));
  const stage = $('#full');
  app.onFrame((s) => {
    stage.style.aspectRatio = `${s.frameWidth} / ${s.frameHeight}`;
    overlay.render(s);
  });
  app.start();
  (window as unknown as { app: typeof app }).app = app;
}

main().catch((e) => console.error(e));
