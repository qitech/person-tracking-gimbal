import type { FrameSnapshot } from '../app/state';

/** `?debug` readout of frame and element geometry, for diagnosing device-specific layout issues. */
export class DebugPanel {
  private el = document.createElement('pre');
  private lastS = 0;
  private bitmap = '–';

  constructor(private video: HTMLVideoElement, private stage: HTMLElement, private canvas: HTMLCanvasElement) {
    Object.assign(this.el.style, {
      position: 'fixed', left: '4px', bottom: '4px', zIndex: '20', margin: '0', padding: '6px 8px',
      font: '11px/1.35 ui-monospace, Menlo, monospace', color: '#e6ecf5',
      background: 'rgba(0,0,0,0.78)', borderRadius: '6px', pointerEvents: 'none', maxWidth: '96vw', whiteSpace: 'pre-wrap',
    });
    document.body.append(this.el);
    setInterval(() => {
      createImageBitmap(this.video).then((b) => { this.bitmap = `${b.width}×${b.height}`; b.close(); }, (e) => { this.bitmap = String(e).slice(0, 40); });
    }, 1000);
  }

  render(s: FrameSnapshot): void {
    if (s.nowS - this.lastS < 0.25) return;
    this.lastS = s.nowS;
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return `${r.width.toFixed(0)}×${r.height.toFixed(0)}`; };
    const track = (this.video.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
    const st = track?.getSettings?.();
    this.el.textContent = [
      `video.videoW×H ${this.video.videoWidth}×${this.video.videoHeight}`,
      `track settings ${st?.width}×${st?.height}`,
      `imageBitmap    ${this.bitmap}`,
      `stage box      ${box(this.stage)}  ar=${this.stage.style.aspectRatio}`,
      `video box      ${box(this.video)}  fit=${getComputedStyle(this.video).objectFit}`,
      `canvas box     ${box(this.canvas)}  px=${this.canvas.width}×${this.canvas.height}`,
      `window         ${innerWidth}×${innerHeight} dpr=${devicePixelRatio} ${screen.orientation?.type ?? ''}`,
      `people ${s.people.length}  detect ${s.metrics.detectMs.toFixed(0)}ms  fps ${s.metrics.fps.toFixed(0)}  ${s.metrics.delegate}`,
    ].join('\n');
  }
}
