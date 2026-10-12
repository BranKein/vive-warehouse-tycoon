/**
 * Small DOM helpers. The UI is updated every animation frame, so every
 * setter here remembers the last value it wrote and touches the DOM only
 * when the value actually changed.
 */

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

export function button(className: string, onClick: (event: MouseEvent) => void, ...children: Child[]): HTMLButtonElement {
  const el = h('button', className, ...children);
  el.type = 'button';
  el.addEventListener('click', onClick);
  return el;
}

const written = new WeakMap<Element, Map<string, string | null>>();

/** Returns true (and records the value) when `value` differs from what was last written to `slot`. */
function changed(el: Element, slot: string, value: string | null): boolean {
  let slots = written.get(el);
  if (!slots) {
    slots = new Map();
    written.set(el, slots);
  }
  if (slots.has(slot) && slots.get(slot) === value) return false;
  slots.set(slot, value);
  return true;
}

export function setText(el: Element, value: string): void {
  if (changed(el, '#text', value)) el.textContent = value;
}

export function setAttr(el: Element, name: string, value: string | null): void {
  if (!changed(el, `@${name}`, value)) return;
  if (value === null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

export function setClass(el: Element, name: string, on: boolean): void {
  if (changed(el, `.${name}`, on ? '1' : '0')) el.classList.toggle(name, on);
}

export function setHidden(el: HTMLElement, hidden: boolean): void {
  if (changed(el, '#hidden', hidden ? '1' : '0')) el.hidden = hidden;
}

export function setDisabled(el: HTMLButtonElement, disabled: boolean): void {
  if (changed(el, '#disabled', disabled ? '1' : '0')) el.disabled = disabled;
}

/** Sets a bar's fill from a 0..1 ratio, rounded so tiny changes do not cause style writes. */
export function setFill(el: HTMLElement, ratio: number): void {
  const percent = `${Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 10}%`;
  if (changed(el, '#fill', percent)) el.style.width = percent;
}

export interface Row<T> {
  el: HTMLElement;
  update(item: T): void;
}

/**
 * Keeps the children of `parent` in step with a list of items. Rows are
 * created once per key and reused; the DOM is only restructured when the
 * sequence of keys changes. `parent` must not have other children.
 */
export class KeyedList<T> {
  private rows = new Map<string, Row<T>>();
  private order: string[] = [];

  constructor(
    private readonly parent: HTMLElement,
    private readonly keyOf: (item: T) => string,
    private readonly create: (item: T) => Row<T>,
  ) {}

  sync(items: readonly T[]): void {
    const keys = items.map(this.keyOf);
    const same = keys.length === this.order.length && keys.every((key, index) => key === this.order[index]);
    if (!same) {
      const next = new Map<string, Row<T>>();
      keys.forEach((key, index) => {
        if (!next.has(key)) next.set(key, this.rows.get(key) ?? this.create(items[index] as T));
      });
      for (const [key, row] of this.rows) if (!next.has(key)) row.el.remove();
      let cursor = this.parent.firstChild;
      for (const row of next.values()) {
        if (row.el === cursor) cursor = cursor.nextSibling;
        else this.parent.insertBefore(row.el, cursor);
      }
      this.rows = next;
      this.order = keys;
    }
    items.forEach((item, index) => this.rows.get(keys[index] as string)?.update(item));
  }

  get size(): number {
    return this.order.length;
  }
}

export interface ConfirmLabels {
  label: string;
  question: string;
  yes: string;
  no: string;
  disabled?: boolean;
}

export interface ConfirmControl {
  el: HTMLElement;
  render(labels: ConfirmLabels): void;
  disarm(): void;
}

/** A button that asks once more before running a destructive action. */
export function createConfirm(className: string, onConfirm: () => void): ConfirmControl {
  let armed = false;
  const question = h('span', 'wt-confirm-question');
  const yes = button('wt-btn wt-btn-danger', () => {
    disarm();
    onConfirm();
  });
  const no = button('wt-btn wt-btn-quiet', () => disarm());
  const ask = h('div', 'wt-confirm-ask', question, h('div', 'wt-confirm-actions', yes, no));
  const trigger = button(`wt-btn ${className}`, () => {
    armed = true;
    apply();
  });
  const el = h('div', 'wt-confirm', trigger, ask);

  function apply(): void {
    setHidden(trigger, armed);
    setHidden(ask, !armed);
  }
  function disarm(): void {
    armed = false;
    apply();
  }
  apply();

  return {
    el,
    render(labels) {
      setText(trigger, labels.label);
      setText(question, labels.question);
      setText(yes, labels.yes);
      setText(no, labels.no);
      setDisabled(trigger, labels.disabled ?? false);
    },
    disarm,
  };
}
