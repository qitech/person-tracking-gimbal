import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { FrameSnapshot } from '../app/state';

const WINDOW_S = 10;
const MIN_REDRAW_S = 1 / 30;
const HEIGHT = 150;
const PAN = '#35d0ff';
const TILT = '#c792ff';
const LIMIT = 'rgba(255, 181, 71, 0.55)';

const axis = (label: string): uPlot.Axis => ({
  label,
  stroke: '#8a97a8',
  grid: { stroke: '#1f2833', width: 1 },
  ticks: { stroke: '#1f2833', width: 1 },
  labelSize: 18,
  size: 44,
});

const timeAxis: uPlot.Axis = { ...axis(''), incrs: [1, 2, 5, 10], values: (_u, vals) => vals.map((v) => `${v.toFixed(0)} с`) };
const timeSeries: uPlot.Series = { label: 'час', value: (_u, v) => (v == null ? '–' : `${v.toFixed(1)} с`) };

/** Rolling 10 s plots of tracking error and gimbal angles. */
export class Charts {
  private t: number[] = [];
  private errPan: (number | null)[] = [];
  private errTilt: (number | null)[] = [];
  private pan: number[] = [];
  private tilt: number[] = [];
  private lim: { panMax: number; tiltMax: number } = { panMax: 0, tiltMax: 0 };
  private lastDraw = 0;
  private errorPlot: uPlot;
  private anglePlot: uPlot;

  constructor(private container: HTMLElement) {
    const width = container.clientWidth || 600;
    this.errorPlot = new uPlot(
      {
        title: 'Похибка наведення, °',
        width, height: HEIGHT,
        legend: { show: true },
        scales: { x: { time: false }, y: { range: (_u, min, max) => { const m = Math.max(3, Math.abs(min ?? 0), Math.abs(max ?? 0)); return [-m, m]; } } },
        axes: [timeAxis, axis('')],
        series: [
          timeSeries,
          { label: 'pan', stroke: PAN, width: 2, spanGaps: false },
          { label: 'tilt', stroke: TILT, width: 2, spanGaps: false },
        ],
      },
      [[], [], []],
      container,
    );
    this.anglePlot = new uPlot(
      {
        title: 'Кути платформи, °',
        width, height: HEIGHT,
        scales: { x: { time: false } },
        axes: [timeAxis, axis('')],
        series: [
          timeSeries,
          { label: 'pan', stroke: PAN, width: 2 },
          { label: 'tilt', stroke: TILT, width: 2 },
          { label: 'межа pan', stroke: LIMIT, width: 1, dash: [6, 4] },
          { label: 'межа tilt', stroke: LIMIT, width: 1, dash: [2, 4] },
        ],
      },
      [[], [], [], [], []],
      container,
    );
    new ResizeObserver(() => this.resize()).observe(container);
  }

  /** Always records; draws only when `draw` (hidden charts on phones skip the work). */
  push(s: FrameSnapshot, draw = true): void {
    this.t.push(s.nowS);
    this.errPan.push(s.error ? s.error.pan : null);
    this.errTilt.push(s.error ? s.error.tilt : null);
    this.pan.push(s.gimbal.pan);
    this.tilt.push(s.gimbal.tilt);
    this.lim = { panMax: s.limits.panMax, tiltMax: s.limits.tiltMax };

    let drop = 0;
    while (drop < this.t.length && this.t[drop] < s.nowS - WINDOW_S) drop++;
    if (drop) for (const a of [this.t, this.errPan, this.errTilt, this.pan, this.tilt]) a.splice(0, drop);

    if (!draw || s.nowS - this.lastDraw < MIN_REDRAW_S) return;
    this.lastDraw = s.nowS;
    const x = this.t.map((v) => v - s.nowS);
    this.errorPlot.setData([x, this.errPan, this.errTilt]);
    this.anglePlot.setData([
      x, this.pan, this.tilt,
      x.map(() => this.lim.panMax), x.map(() => this.lim.tiltMax),
    ]);
  }

  resize(): void {
    const width = this.container.clientWidth;
    if (!width) return;
    this.errorPlot.setSize({ width, height: HEIGHT });
    this.anglePlot.setSize({ width, height: HEIGHT });
  }
}
