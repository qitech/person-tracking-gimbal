import type { App } from '../app/loop';
import type { AppSettings, FrameSnapshot } from '../app/state';
import { PRESET_LABELS, type PresetName } from '../control/presets';

interface SliderSpec {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  get: (s: AppSettings) => number;
  set: (v: number) => Partial<AppSettings>;
  digits?: number;
}

const SLIDERS: SliderSpec[] = [
  { label: 'Kp', unit: '', min: 0, max: 30, step: 0.1, get: (s) => s.pid.kp, set: (v) => ({ pid: { kp: v } as AppSettings['pid'] }), digits: 1 },
  { label: 'Ki', unit: '', min: 0, max: 5, step: 0.1, get: (s) => s.pid.ki, set: (v) => ({ pid: { ki: v } as AppSettings['pid'] }), digits: 1 },
  { label: 'Kd', unit: '', min: 0, max: 2, step: 0.05, get: (s) => s.pid.kd, set: (v) => ({ pid: { kd: v } as AppSettings['pid'] }), digits: 2 },
  { label: 'Мертва зона', unit: '°', min: 0, max: 3, step: 0.1, get: (s) => s.pid.deadbandDeg, set: (v) => ({ pid: { deadbandDeg: v } as AppSettings['pid'] }), digits: 1 },
  { label: 'Макс. швидкість', unit: '°/с', min: 30, max: 360, step: 10, get: (s) => s.servo.maxVel, set: (v) => ({ servo: { maxVel: v } as AppSettings['servo'] }) },
  { label: 'Прискорення', unit: '°/с²', min: 100, max: 2000, step: 50, get: (s) => s.servo.maxAccel, set: (v) => ({ servo: { maxAccel: v } as AppSettings['servo'] }) },
  { label: 'Затримка', unit: 'мс', min: 0, max: 300, step: 10, get: (s) => s.servo.delayS * 1000, set: (v) => ({ servo: { delayS: v / 1000 } as AppSettings['servo'] }) },
  { label: 'Поле зору віртуальної камери', unit: '°', min: 10, max: 65, step: 1, get: (s) => s.virtHfovDeg, set: (v) => ({ virtHfovDeg: v }) },
  { label: 'Поле зору камери ноутбука', unit: '°', min: 50, max: 90, step: 1, get: (s) => s.physHfovDeg, set: (v) => ({ physHfovDeg: v }) },
  { label: 'Згладжування', unit: '', min: 0.1, max: 1, step: 0.05, get: (s) => s.smoothingAlpha, set: (v) => ({ smoothingAlpha: v }), digits: 2 },
];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** Control panel: mode, PID presets, manual sliders, advanced settings. */
export class Controls {
  private modeBtns: Record<'auto' | 'manual', HTMLButtonElement>;
  private presetBtns: Record<PresetName, HTMLButtonElement>;
  private customTag: HTMLElement;
  private manualBox: HTMLElement;
  private manualSliders: { pan: HTMLInputElement; tilt: HTMLInputElement; panVal: HTMLElement; tiltVal: HTMLElement };
  private sliders: { spec: SliderSpec; input: HTMLInputElement; value: HTMLElement }[] = [];
  private aimSelect: HTMLSelectElement;
  /** Mode, presets and manual sliders: the bottom bar on phones. */
  readonly quick: HTMLElement;
  /** Advanced settings: a sheet tab on phones. */
  readonly advanced: HTMLDetailsElement;

  constructor(container: HTMLElement, private app: App) {
    container.append(el('div', 'panel-title', 'Керування'));

    // Mode
    const modeRow = el('div', 'ctl-row');
    modeRow.append(el('span', 'ctl-label', 'Режим'));
    const seg = el('div', 'segmented');
    this.modeBtns = {
      auto: this.button('Авто', () => app.updateSettings({ mode: 'auto' })),
      manual: this.button('Ручний', () => app.updateSettings({ mode: 'manual' })),
    };
    seg.append(this.modeBtns.auto, this.modeBtns.manual);
    modeRow.append(seg);

    // Presets
    const presetRow = el('div', 'ctl-row ctl-wrap');
    presetRow.append(el('span', 'ctl-label', 'Регулятор'));
    const presets = el('div', 'btn-group');
    this.presetBtns = {} as Record<PresetName, HTMLButtonElement>;
    for (const name of Object.keys(PRESET_LABELS) as PresetName[]) {
      this.presetBtns[name] = this.button(PRESET_LABELS[name], () => app.updateSettings({ preset: name }));
      presets.append(this.presetBtns[name]);
    }
    this.customTag = el('span', 'tag', 'Власні');
    presets.append(this.customTag);
    presetRow.append(presets);

    // Manual
    this.manualBox = el('div', 'manual-box');
    const mk = (axis: 'pan' | 'tilt') => {
      const row = el('label', 'slider-row');
      const input = el('input');
      input.type = 'range';
      input.step = '0.1';
      const val = el('span', 'slider-val');
      input.addEventListener('input', () => {
        const cur = app.getSettings().manual;
        app.updateSettings({ manual: { ...cur, [axis]: Number(input.value) } });
      });
      row.append(el('span', 'slider-name', axis), input, val);
      this.manualBox.append(row);
      return { input, val };
    };
    const pan = mk('pan'), tilt = mk('tilt');
    this.manualSliders = { pan: pan.input, tilt: tilt.input, panVal: pan.val, tiltVal: tilt.val };
    this.manualBox.append(el('div', 'ctl-hint', 'Або стрілки на клавіатурі ← → ↑ ↓'));

    // Advanced
    const details = el('details', 'advanced');
    details.append(el('summary', '', 'Розширені налаштування'));
    for (const spec of SLIDERS) {
      const row = el('label', 'slider-row');
      const input = el('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      const value = el('span', 'slider-val');
      input.addEventListener('input', () => {
        app.updateSettings(spec.set(Number(input.value)));
        this.sync();
      });
      row.append(el('span', 'slider-name', spec.label), input, value);
      details.append(row);
      this.sliders.push({ spec, input, value });
    }
    const aimRow = el('label', 'slider-row');
    this.aimSelect = el('select');
    this.aimSelect.append(new Option('торс', 'torso'), new Option('голова', 'head'));
    this.aimSelect.addEventListener('change', () =>
      app.updateSettings({ aimMode: this.aimSelect.value as AppSettings['aimMode'] }));
    aimRow.append(el('span', 'slider-name', 'Точка наведення'), this.aimSelect);
    details.append(aimRow);

    this.quick = el('div', 'ctl-quick');
    this.quick.append(modeRow, presetRow, this.manualBox);
    this.advanced = details;
    container.append(this.quick, details);
    this.sync();
  }

  /** Per-frame update: active buttons, manual slider ranges and values. */
  render(s: FrameSnapshot): void {
    const st = this.app.getSettings();
    this.modeBtns.auto.classList.toggle('active', st.mode === 'auto');
    this.modeBtns.manual.classList.toggle('active', st.mode === 'manual');
    for (const [name, b] of Object.entries(this.presetBtns)) b.classList.toggle('active', st.preset === name);
    this.customTag.hidden = st.preset !== 'custom';
    this.manualBox.hidden = st.mode !== 'manual';

    const m = this.manualSliders;
    const setRange = (i: HTMLInputElement, min: number, max: number) => {
      if (i.min !== min.toFixed(1)) i.min = min.toFixed(1);
      if (i.max !== max.toFixed(1)) i.max = max.toFixed(1);
    };
    setRange(m.pan, s.limits.panMin, s.limits.panMax);
    setRange(m.tilt, s.limits.tiltMin, s.limits.tiltMax);
    if (document.activeElement !== m.pan) m.pan.value = String(st.manual.pan);
    if (document.activeElement !== m.tilt) m.tilt.value = String(st.manual.tilt);
    m.panVal.textContent = `${s.gimbal.pan.toFixed(1)}°`;
    m.tiltVal.textContent = `${s.gimbal.tilt.toFixed(1)}°`;
  }

  private sync(): void {
    const st = this.app.getSettings();
    for (const { spec, input, value } of this.sliders) {
      const v = spec.get(st);
      if (document.activeElement !== input) input.value = String(v);
      value.textContent = `${v.toFixed(spec.digits ?? 0)}${spec.unit ? ' ' + spec.unit : ''}`;
    }
    this.aimSelect.value = st.aimMode;
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', 'btn', label);
    b.type = 'button';
    b.addEventListener('click', () => {
      onClick();
      this.sync();
    });
    return b;
  }
}
