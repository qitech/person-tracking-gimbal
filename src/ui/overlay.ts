import { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { FrameSnapshot } from '../app/state';
import { VISIBILITY_THRESHOLD } from '../detection/aimPoint';
import type { Person, Point } from '../types';

export const COLORS = {
  target: '#35d0ff',
  other: 'rgba(230, 236, 245, 0.35)',
  fov: '#ffb547',
  aim: '#ff4d6d',
};

/** Full-frame canvas: skeletons, aim point, virtual FOV window and the error line. */
export class Overlay {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement, private video: HTMLVideoElement, onClick: (p: Point) => void) {
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      onClick({
        x: ((e.clientX - r.left) / r.width) * this.video.videoWidth,
        y: ((e.clientY - r.top) / r.height) * this.video.videoHeight,
      });
    });
  }

  render(s: FrameSnapshot): void {
    const { canvas, ctx } = this;
    if (canvas.width !== s.frameWidth || canvas.height !== s.frameHeight) {
      canvas.width = s.frameWidth;
      canvas.height = s.frameHeight;
    }
    const lw = Math.max(2, s.frameWidth / 400);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    s.people.forEach((p, i) => {
      if (i !== s.tracker.targetIndex) this.drawSkeleton(p, COLORS.other, lw);
    });
    const target = s.tracker.targetIndex !== null ? s.people[s.tracker.targetIndex] : null;
    if (target) this.drawSkeleton(target, COLORS.target, lw * 1.5);

    const f = s.fov;
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    ctx.strokeStyle = COLORS.fov;
    ctx.lineWidth = lw * 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    ctx.beginPath();
    ctx.arc(cx, cy, lw * 3, 0, Math.PI * 2);
    ctx.stroke();

    const aim = s.tracker.aim;
    if (aim) {
      ctx.strokeStyle = COLORS.aim;
      ctx.lineWidth = lw;
      ctx.setLineDash([lw * 4, lw * 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(aim.x, aim.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.aim;
      ctx.beginPath();
      ctx.arc(aim.x, aim.y, lw * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawSkeleton(p: Person, color: string, lw: number): void {
    const { ctx } = this;
    const k = p.keypoints;
    const vis = (i: number) => k[i] && k[i].visibility >= VISIBILITY_THRESHOLD;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
      if (!vis(start) || !vis(end)) continue;
      ctx.moveTo(k[start].x, k[start].y);
      ctx.lineTo(k[end].x, k[end].y);
    }
    ctx.stroke();
    k.forEach((pt, i) => {
      if (i > 10 && vis(i)) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, lw * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}
