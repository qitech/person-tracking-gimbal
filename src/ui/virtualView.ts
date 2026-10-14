import type { Mode } from '../app/controller';
import type { FrameSnapshot } from '../app/state';
import type { TrackerStateName } from '../tracking/targetTracker';

export const STATE_LABELS: Record<TrackerStateName | 'manual', string> = {
  searching: 'Пошук',
  tracking: 'Супровід',
  lost: 'Ціль втрачено',
  returning: 'Повернення',
  manual: 'Ручний режим',
};

const STATE_COLORS: Record<TrackerStateName | 'manual', string> = {
  searching: '#8a97a8',
  tracking: '#3ddc97',
  lost: '#ff4d6d',
  returning: '#ffb547',
  manual: '#35d0ff',
};

/** What the virtual pan/tilt camera "sees": the FOV window cropped from the full frame. */
export class VirtualView {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement, private video: HTMLVideoElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  render(s: FrameSnapshot, mode: Mode): void {
    const { canvas, ctx } = this;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

    const f = s.fov;
    ctx.drawImage(this.video, f.x, f.y, f.w, f.h, 0, 0, w, h);

    // Crosshair
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.06;
    ctx.strokeStyle = 'rgba(255, 181, 71, 0.9)';
    ctx.lineWidth = Math.max(1.5, dpr * 1.5);
    ctx.beginPath();
    ctx.moveTo(cx - r * 2, cy); ctx.lineTo(cx - r * 0.5, cy);
    ctx.moveTo(cx + r * 0.5, cy); ctx.lineTo(cx + r * 2, cy);
    ctx.moveTo(cx, cy - r * 2); ctx.lineTo(cx, cy - r * 0.5);
    ctx.moveTo(cx, cy + r * 0.5); ctx.lineTo(cx, cy + r * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // State badge
    const key = mode === 'manual' ? 'manual' : s.tracker.state;
    const label = STATE_LABELS[key];
    const fs = Math.round(13 * dpr);
    ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
    const pad = 8 * dpr, tw = ctx.measureText(label).width;
    const bx = 10 * dpr, by = 10 * dpr, bw = tw + pad * 2 + fs, bh = fs + pad * 1.4;
    ctx.fillStyle = 'rgba(11, 15, 20, 0.75)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = STATE_COLORS[key];
    ctx.beginPath();
    ctx.arc(bx + pad + fs * 0.3, by + bh / 2, fs * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e6ecf5';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + pad + fs * 0.9, by + bh / 2 + dpr);

    // Angle readout
    const txt = `pan ${s.gimbal.pan.toFixed(1)}°  tilt ${s.gimbal.tilt.toFixed(1)}°`;
    ctx.font = `${Math.round(12 * dpr)}px ui-monospace, Menlo, monospace`;
    ctx.fillStyle = 'rgba(230, 236, 245, 0.85)';
    ctx.textAlign = 'right';
    ctx.fillText(txt, w - 12 * dpr, h - 14 * dpr);
    ctx.textAlign = 'left';
  }
}
