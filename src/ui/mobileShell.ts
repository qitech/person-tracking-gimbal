/**
 * Phone layout: one screen without page scroll. The full frame fills the screen with the
 * virtual camera as picture-in-picture (CSS), quick controls sit in a bottom bar, and
 * charts / 3D / advanced settings move into a bottom sheet with tabs. Desktop keeps the
 * original DOM: attach() moves nodes in, detach() puts them back where they were.
 */
export interface MobileParts {
  quick: HTMLElement;
  advanced: HTMLDetailsElement;
  charts: HTMLElement;
  gimbal: HTMLElement;
}

type Tab = 'charts' | 'gimbal' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'charts', label: 'Графіки' },
  { id: 'gimbal', label: '3D' },
  { id: 'settings', label: 'Налаштування' },
];

interface Home { node: HTMLElement; parent: Node; next: Node | null }

export class MobileShell {
  private bar: HTMLElement;
  private sheet: HTMLElement;
  private backdrop: HTMLElement;
  private panes: Record<Tab, HTMLElement>;
  private tabBtns: Record<Tab, HTMLButtonElement>;
  private homes: Home[] = [];
  private attached = false;
  private open = false;
  private tab: Tab = 'charts';

  constructor(private parts: MobileParts) {
    const el = (tag: string, cls: string, text = '') => {
      const e = document.createElement(tag);
      e.className = cls;
      if (text) e.textContent = text;
      return e;
    };

    this.bar = el('div', 'mobile-bar');
    const more = el('button', 'btn more-btn', 'Більше') as HTMLButtonElement;
    more.type = 'button';
    more.addEventListener('click', () => this.setOpen(true));
    this.bar.append(more);

    this.backdrop = el('div', 'sheet-backdrop');
    this.backdrop.addEventListener('click', () => this.setOpen(false));

    this.sheet = el('div', 'sheet');
    const head = el('div', 'sheet-head');
    const tabs = el('div', 'segmented sheet-tabs');
    this.tabBtns = {} as Record<Tab, HTMLButtonElement>;
    for (const t of TABS) {
      const b = el('button', 'btn', t.label) as HTMLButtonElement;
      b.type = 'button';
      b.addEventListener('click', () => this.setTab(t.id));
      this.tabBtns[t.id] = b;
      tabs.append(b);
    }
    const close = el('button', 'btn ghost', 'Закрити') as HTMLButtonElement;
    close.type = 'button';
    close.addEventListener('click', () => this.setOpen(false));
    head.append(tabs, close);
    const body = el('div', 'sheet-body');
    this.panes = { charts: el('div', 'sheet-pane'), gimbal: el('div', 'sheet-pane'), settings: el('div', 'sheet-pane') };
    body.append(this.panes.charts, this.panes.gimbal, this.panes.settings);
    this.sheet.append(head, body);
    this.setTab('charts');
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    const { quick, advanced, charts, gimbal } = this.parts;
    for (const node of [quick, advanced, charts, gimbal]) {
      this.homes.push({ node, parent: node.parentNode!, next: node.nextSibling });
    }
    this.bar.prepend(quick);
    this.panes.charts.append(charts);
    this.panes.gimbal.append(gimbal);
    this.panes.settings.append(advanced);
    advanced.open = true;
    document.body.append(this.bar, this.backdrop, this.sheet);
    document.body.classList.add('mobile');
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.setOpen(false);
    for (const { node, parent, next } of this.homes.reverse()) parent.insertBefore(node, next);
    this.homes = [];
    this.parts.advanced.open = false;
    this.bar.remove();
    this.backdrop.remove();
    this.sheet.remove();
    document.body.classList.remove('mobile');
  }

  /** Whether a panel is on screen, so hidden 3D/charts can skip rendering on phones. */
  isShown(panel: 'charts' | 'gimbal'): boolean {
    return !this.attached || (this.open && this.tab === panel);
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.sheet.classList.toggle('open', open);
    this.backdrop.classList.toggle('open', open);
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    for (const t of TABS) {
      this.tabBtns[t.id].classList.toggle('active', t.id === tab);
      this.panes[t.id].hidden = t.id !== tab;
    }
  }
}
