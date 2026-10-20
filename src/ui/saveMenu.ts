import type { ManualSaveEntry } from '@/contracts';
import { getLanguage } from '@/i18n';
import type { UIContext } from './context';
import { createCloudSection } from './cloudSection';
import { button, createConfirm, h, KeyedList, setAttr, setDisabled, setHidden, setText, type Row } from './dom';
import { formatSaveSummary } from './text';

const DATE_LOCALES = { en: 'en-US', ko: 'ko-KR' } as const;

export function formatSaveDate(savedAt: number, language: keyof typeof DATE_LOCALES): string {
  return new Date(savedAt).toLocaleString(DATE_LOCALES[language], { dateStyle: 'medium', timeStyle: 'short' });
}

/** Popover with manual saves, the auto save and the reset button. Not driven by the snapshot. */
export function createSaveMenu(ctx: UIContext, onToggle: () => void) {
  const { tr, saves } = ctx;
  let open = false;
  let busy = false;
  let disposed = false;
  let entries: ManualSaveEntry[] = [];
  let hasAuto = false;
  let refreshToken = 0;

  const title = h('h3', 'wt-menu-title');
  const close = button('wt-icon-btn', () => setOpen(false), '×');
  const saveNow = button('wt-btn wt-btn-primary', () =>
    act(async () => {
      await saves.saveManual();
      ctx.notify('good', () => tr.t('save.saved'));
    }),
  );
  const loadAuto = button('wt-btn', () =>
    act(async () => {
      const ok = await saves.loadAuto();
      ctx.notify(ok ? 'good' : 'error', () => tr.t(ok ? 'save.loaded' : 'save.loadFailed'));
      if (ok) setOpen(false);
    }),
  );
  const listTitle = h('div', 'wt-section-title');
  const empty = h('p', 'wt-hint');
  const listBox = h('div', 'wt-save-list');
  const reset = createConfirm('wt-btn-danger-soft', () =>
    act(async () => {
      await saves.reset();
      ctx.notify('info', () => tr.t('save.resetDone'));
      setOpen(false);
    }),
  );

  const list = new KeyedList<ManualSaveEntry>(
    listBox,
    (entry) => entry.id,
    (first): Row<ManualSaveEntry> => {
      const id = first.id;
      const date = h('div', 'wt-save-date');
      const summary = h('div', 'wt-save-summary');
      const load = button('wt-btn', () =>
        act(async () => {
          const ok = await saves.loadManual(id);
          ctx.notify(ok ? 'good' : 'error', () => tr.t(ok ? 'save.loaded' : 'save.loadFailed'));
          if (ok) setOpen(false);
        }),
      );
      const remove = createConfirm('wt-btn-quiet', () =>
        act(async () => {
          await saves.deleteManual(id);
          ctx.notify('info', () => tr.t('save.deleted'));
        }),
      );
      const el = h('div', 'wt-save', h('div', 'wt-save-info', date, summary), h('div', 'wt-save-actions', load, remove.el));
      return {
        el,
        update(entry) {
          setText(date, formatSaveDate(entry.savedAt, getLanguage()));
          setText(summary, formatSaveSummary(tr, entry.summary));
          setText(load, tr.t('save.load'));
          setDisabled(load, busy);
          remove.render({
            label: tr.t('save.delete'),
            question: tr.t('save.deleteConfirm'),
            yes: tr.t('common.confirm'),
            no: tr.t('common.cancel'),
            disabled: busy,
          });
        },
      };
    },
  );

  // Loading from the cloud replaces the game, like loading a save here.
  const cloud = ctx.cloud ? createCloudSection(ctx, ctx.cloud, () => setOpen(false)) : null;

  const el = h(
    'div',
    'wt-menu wt-card',
    h('div', 'wt-menu-head', title, close),
    h('div', 'wt-menu-actions', saveNow, loadAuto),
    ...(cloud ? [cloud.el] : []),
    listTitle,
    empty,
    listBox,
    h('div', 'wt-menu-foot', reset.el),
  );
  el.setAttribute('role', 'dialog');

  function render(): void {
    setHidden(el, !open);
    setText(title, tr.t('save.menu'));
    setAttr(el, 'aria-label', tr.t('save.menu'));
    setAttr(close, 'aria-label', tr.t('common.close'));
    setAttr(close, 'title', tr.t('common.close'));
    setText(saveNow, tr.t('save.saveNow'));
    setDisabled(saveNow, busy);
    setText(loadAuto, hasAuto ? tr.t('save.loadAuto') : tr.t('save.noAuto'));
    setDisabled(loadAuto, busy || !hasAuto);
    setText(listTitle, tr.t('save.manualList'));
    setText(empty, tr.t('save.empty'));
    setHidden(empty, entries.length > 0);
    list.sync(entries);
    cloud?.render();
    reset.render({
      label: tr.t('save.reset'),
      question: tr.t('save.resetConfirm'),
      yes: tr.t('common.confirm'),
      no: tr.t('common.cancel'),
      disabled: busy,
    });
  }

  async function refresh(): Promise<void> {
    const token = (refreshToken += 1);
    try {
      const [nextEntries, nextHasAuto] = await Promise.all([saves.listManual(), saves.hasAuto()]);
      if (disposed || token !== refreshToken) return;
      entries = nextEntries;
      hasAuto = nextHasAuto;
    } catch (error) {
      console.error(error);
      if (!disposed) ctx.notify('error', () => tr.t('save.error'));
    }
    if (!disposed) render();
  }

  /** Runs one save action at a time, reports failures, then reloads the list. */
  async function act(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    render();
    try {
      await work();
    } catch (error) {
      console.error(error);
      if (!disposed) ctx.notify('error', () => tr.t('save.error'));
    }
    busy = false;
    if (!disposed) await refresh();
  }

  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    if (!open) {
      reset.disarm();
      cloud?.disarm();
    }
    render();
    if (open) {
      cloud?.opened();
      void refresh();
    }
    onToggle();
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (open && event.key === 'Escape') setOpen(false);
  };
  document.addEventListener('keydown', onKeyDown);
  render();

  return {
    el,
    isOpen: (): boolean => open,
    open: (): void => setOpen(true),
    toggle: (): void => setOpen(!open),
    close: (): void => setOpen(false),
    rerender: render,
    dispose(): void {
      disposed = true;
      cloud?.dispose();
      document.removeEventListener('keydown', onKeyDown);
      el.remove();
    },
  };
}
