import { startCamera } from './camera/camera';
import { createApp } from './app/loop';
import { PoseDetector } from './detection/poseDetector';
import { Gimbal3D } from './ui/gimbal3d';
import { Overlay } from './ui/overlay';
import { VirtualView } from './ui/virtualView';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

async function main() {
  const video = $<HTMLVideoElement>('#video');
  const [detector] = await Promise.all([
    PoseDetector.create({ wasmBase: './wasm', modelUrl: './models/pose_landmarker_lite.task' }),
    startCamera(video),
  ]);
  const app = createApp({ video, detector });
  const overlay = new Overlay($<HTMLCanvasElement>('#overlay'), video, (p) => app.selectAt(p));
  const virtualView = new VirtualView($<HTMLCanvasElement>('#virtual'), video);
  const gimbal3d = new Gimbal3D($('#gimbal3d'));
  const stages = [$('#full'), $('#virtual-stage')];
  app.onFrame((s) => {
    const ratio = `${s.frameWidth} / ${s.frameHeight}`;
    for (const st of stages) if (st.style.aspectRatio !== ratio) st.style.aspectRatio = ratio;
    overlay.render(s);
    virtualView.render(s, app.getSettings().mode);
    gimbal3d.render(s);
  });
  app.start();
  (window as unknown as { app: typeof app }).app = app;
}

main().catch((e) => console.error(e));
