// Copies MediaPipe WASM files into public/ and downloads the pose model once,
// so the deployed demo never depends on third-party CDNs at runtime.
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// Only the classic (non-module) builds are loaded by FilesetResolver.forVisionTasks(base).
await cp(join(root, 'node_modules/@mediapipe/tasks-vision/wasm'), join(root, 'public/wasm'), {
  recursive: true,
  filter: (src) => !src.includes('_module_'),
});

const modelPath = join(root, 'public/models/pose_landmarker_lite.task');
const exists = await stat(modelPath).then(() => true, () => false);
if (!exists) {
  await mkdir(dirname(modelPath), { recursive: true });
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: ${res.status}`);
  await writeFile(modelPath, Buffer.from(await res.arrayBuffer()));
}
console.log('Assets ready');
