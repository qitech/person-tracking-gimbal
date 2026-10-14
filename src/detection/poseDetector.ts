import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Person } from '../types';
import { toPerson } from './aimPoint';

export interface PoseDetectorOptions {
  wasmBase: string;
  modelUrl: string;
  onProgress?: (fraction: number) => void;
}

const NUM_POSES = 3;

async function fetchWithProgress(url: string, onProgress?: (f: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Failed to load model: ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress?.(Math.min(1, received / total));
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  onProgress?.(1);
  return out;
}

/** MediaPipe Pose Landmarker (lite) in VIDEO mode; GPU with CPU fallback. */
export class PoseDetector {
  private constructor(private landmarker: PoseLandmarker, readonly delegate: 'GPU' | 'CPU') {}

  static async create(opts: PoseDetectorOptions): Promise<PoseDetector> {
    const [fileset, model] = await Promise.all([
      FilesetResolver.forVisionTasks(opts.wasmBase),
      fetchWithProgress(opts.modelUrl, opts.onProgress),
    ]);
    const make = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: model, delegate },
        runningMode: 'VIDEO',
        numPoses: NUM_POSES,
      });
    try {
      return new PoseDetector(await make('GPU'), 'GPU');
    } catch {
      return new PoseDetector(await make('CPU'), 'CPU');
    }
  }

  /** timestampMs must strictly increase between calls (MediaPipe requirement). */
  detect(video: HTMLVideoElement, timestampMs: number): Person[] {
    const { videoWidth: w, videoHeight: h } = video;
    const result = this.landmarker.detectForVideo(video, timestampMs);
    return result.landmarks.map((pose) =>
      toPerson(pose.map((l) => ({ x: l.x * w, y: l.y * h, visibility: l.visibility ?? 0 }))),
    );
  }

  close(): void {
    this.landmarker.close();
  }
}
