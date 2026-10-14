export type CameraErrorKind = 'denied' | 'notFound' | 'busy' | 'unsupported' | 'other';

export class CameraError extends Error {
  constructor(readonly kind: CameraErrorKind, message: string) {
    super(message);
    this.name = 'CameraError';
  }
}

export function classifyCameraError(e: unknown): CameraErrorKind {
  switch ((e as { name?: string })?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'notFound';
    case 'NotReadableError': // camera held by another app (Zoom, Teams…)
    case 'AbortError':
      return 'busy';
    default:
      return 'other';
  }
}

export async function startCamera(video: HTMLVideoElement): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported', 'getUserMedia is not available');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
  } catch (e) {
    throw new CameraError(classifyCameraError(e), String(e));
  }
}
