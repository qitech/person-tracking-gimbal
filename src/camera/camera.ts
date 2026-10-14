export type CameraErrorKind = 'denied' | 'notFound' | 'unsupported' | 'other';

export class CameraError extends Error {
  constructor(readonly kind: CameraErrorKind, message: string) {
    super(message);
    this.name = 'CameraError';
  }
}

export async function startCamera(video: HTMLVideoElement): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported', 'getUserMedia is not available');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraError('denied', String(e));
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new CameraError('notFound', String(e));
    throw new CameraError('other', String(e));
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
}
