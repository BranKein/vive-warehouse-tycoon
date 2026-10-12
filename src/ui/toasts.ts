import { button, h, setAttr, setText } from './dom';
import type { ToastKind } from './context';
import type { Translator } from './text';

interface Toast {
  el: HTMLElement;
  render(): void;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface ToastOptions {
  title?: () => string;
  /** Milliseconds before it goes away by itself; 0 keeps it until dismissed. */
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 5000;
const MAX_VISIBLE = 5;

export function createToasts(tr: Translator) {
  const el = h('div', 'wt-toasts');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  const toasts: Toast[] = [];

  function remove(toast: Toast): void {
    const index = toasts.indexOf(toast);
    if (index < 0) return;
    toasts.splice(index, 1);
    if (toast.timer !== null) clearTimeout(toast.timer);
    toast.el.remove();
  }

  return {
    el,
    push(kind: ToastKind, body: () => string, options: ToastOptions = {}): void {
      const title = options.title ? h('strong', 'wt-toast-title') : null;
      const text = h('span', 'wt-toast-text');
      const close = button('wt-icon-btn wt-toast-close', () => remove(toast), '×');
      const node = h('div', `wt-toast wt-toast-${kind}`, h('div', 'wt-toast-body', title, text), close);
      const toast: Toast = {
        el: node,
        timer: null,
        render() {
          if (title && options.title) setText(title, options.title());
          setText(text, body());
          setAttr(close, 'aria-label', tr.t('notice.dismiss'));
          setAttr(close, 'title', tr.t('notice.dismiss'));
        },
      };
      toast.render();
      const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
      if (ttl > 0) toast.timer = setTimeout(() => remove(toast), ttl);
      toasts.push(toast);
      el.append(node);
      while (toasts.length > MAX_VISIBLE) remove(toasts[0] as Toast);
    },
    rerender(): void {
      for (const toast of toasts) toast.render();
    },
    dispose(): void {
      for (const toast of [...toasts]) remove(toast);
      el.remove();
    },
  };
}
