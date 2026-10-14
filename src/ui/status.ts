export type StatusKind = 'loading' | 'cameraDenied' | 'cameraNotFound' | 'unsupported' | 'error' | 'noPerson' | 'none';

const MESSAGES: Partial<Record<StatusKind, string>> = {
  cameraDenied: 'Немає доступу до камери. Дозвольте доступ у налаштуваннях браузера і натисніть «Спробувати ще раз».',
  cameraNotFound: 'Камеру не знайдено. Підключіть камеру і натисніть «Спробувати ще раз».',
  unsupported: 'Ваш браузер не підтримує потрібні технології. Відкрийте демо в Chrome або Edge.',
  error: 'Щось пішло не так. Спробуйте оновити сторінку.',
};

/** Full-screen status (loading, errors) plus an unobtrusive hint on the full frame. */
export class StatusOverlay {
  private current: StatusKind = 'none';

  constructor(private container: HTMLElement, private hint: HTMLElement, private onRetry: () => void) {}

  show(kind: StatusKind, progress?: number): void {
    this.hint.hidden = kind !== 'noPerson';
    if (kind === 'noPerson') this.hint.textContent = 'Станьте перед камерою';
    const fullscreen = kind !== 'none' && kind !== 'noPerson';
    this.container.hidden = !fullscreen;
    if (!fullscreen) {
      this.current = kind;
      return;
    }

    if (kind === 'loading') {
      const pct = Math.round((progress ?? 0) * 100);
      if (this.current !== 'loading') {
        this.container.replaceChildren(this.box(`Завантаження моделі… ${pct}%`, true));
      } else {
        this.container.querySelector('.status-text')!.textContent = `Завантаження моделі… ${pct}%`;
        (this.container.querySelector('.progress > div') as HTMLElement).style.width = `${pct}%`;
      }
    } else if (kind !== this.current) {
      const box = this.box(MESSAGES[kind]!, false);
      if (kind === 'cameraDenied' || kind === 'cameraNotFound') {
        const b = document.createElement('button');
        b.className = 'btn active';
        b.type = 'button';
        b.textContent = 'Спробувати ще раз';
        b.addEventListener('click', () => this.onRetry());
        box.append(b);
      }
      this.container.replaceChildren(box);
    }
    this.current = kind;
  }

  private box(text: string, withProgress: boolean): HTMLElement {
    const box = document.createElement('div');
    box.className = 'status-box';
    const p = document.createElement('div');
    p.className = 'status-text';
    p.textContent = text;
    box.append(p);
    if (withProgress) {
      const bar = document.createElement('div');
      bar.className = 'progress';
      bar.append(document.createElement('div'));
      (bar.firstChild as HTMLElement).style.width = '0%';
      box.append(bar);
    }
    return box;
  }
}
