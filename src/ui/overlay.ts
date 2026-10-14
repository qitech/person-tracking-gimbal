import { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { FrameSnapshot } from '../app/state';
import { VISIBILITY_THRESHOLD } from '../detection/aimPoint';
import type { Person, Point } from '../types';
import { clientToFrame } from './fit';

export const COLORS = {
  target: '#35d0ff',
  other: 'rgba(230, 236, 245, 0.35)',
  fov: '#ffb547',
  aim: '#ff4d6d',
};

/**
 * Full-frame canvas: the camera frame itself, then skeletons, aim point, FOV window and error line.
 * The frame is painted here rather than shown via <video>: iOS Safari paints a camera <video>
 * out of sync with its CSS box, which made the markings drift off the image.
 */
export class Overlay {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement, private video: HTMLVideoElement, onClick: (p: Point) => void) {
    this.ctx = canvas.getContext('2d')!;
    // The canvas is contain-fitted, so clicks on the letterbox bars are ignored.
    canvas.addEventListener('click', (e) => {
      const p = clientToFrame({ x: e.clientX, y: e.clientY }, canvas.getBoundingClientRect(), canvas.width, canvas.height);
      if (p) onClick(p);
    });
  }

  render(s: FrameSnapshot): void {
    const { canvas, ctx } = this;
    if (canvas.width !== s.frameWidth || canvas.height !== s.frameHeight) {
      canvas.width = s.frameWidth;
      canvas.height = s.frameHeight;
    }
    const lw = Math.max(2, s.frameWidth / 400);
    ctx.drawImage(this.video, 0, 0, s.frameWidth, s.frameHeight);

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
