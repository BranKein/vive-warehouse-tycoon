/**
 * The HTML overlay: top bar, bottom dock, build window, hover card, save menu and notifications.
 * It reads `GameSnapshot`, calls `GameCommands` and `SaveController`, and
 * knows nothing else about the simulation or the 3D view.
 */
import type { BigNum } from '@/core/BigNum';
import { formatDuration } from '@/core/format';
import type { CommandResult, GameEvent, GameSnapshot, GameUI, PickTarget, Selection, UIDeps, UnlockView } from '@/contracts';
import { i18n, keys } from '@/i18n';
import { createBuildModal } from './buildModal';
import type { Frame, ToastKind, UIContext } from './context';
import { createHoverCard } from './hoverCard';
import { createSaveMenu } from './saveMenu';
import { createSettingsMenu } from './settingsMenu';
import { createSidePanel } from './sidePanel';
import { createStatsModal } from './statsModal';
import { createStatsPanel } from './statsPanel';
import { formatAmount, unlockName } from './text';
import { createToasts } from './toasts';
import { createTopBar } from './topBar';
import './styles.css';

const AWAY_NOTICE_TTL_MS = 20000;

export const sameSelection = (a: Selection, b: Selection): boolean => {
  if (a.type !== b.type) return false;
  if (a.type === 'plot' && b.type === 'plot') return a.plotId === b.plotId;
  if (a.type === 'building' && b.type === 'building') return a.buildingId === b.buildingId;
  if (a.type === 'facility' && b.type === 'facility') return a.facilityId === b.facilityId;
  return true;
};

export function createUI(root: HTMLElement, deps: UIDeps): GameUI {
  const tr = i18n;
  let selection: Selection = { type: 'none' };
  let last: GameSnapshot | null = null;
  let disposed = false;
  /**
   * The building that stood on the selected plot when it was selected. A plot
   * is selected right after its building is demolished, while the snapshot in
   * hand may still show that building; it must not pull the selection back.
   */
  let plotWasOccupiedBy: string | null = null;

  function setCurrent(next: Selection): void {
    selection = next;
    plotWasOccupiedBy =
      next.type === 'plot' ? (last?.island.plots.find((plot) => plot.id === next.plotId)?.buildingId ?? null) : null;
  }

  const toasts = createToasts(tr);
  const notify = (kind: ToastKind, render: () => string): void => toasts.push(kind, render);

  /** Opens the tab that belongs to what was just selected. An empty plot opens the build window by itself. */
  function follow(next: Selection): void {
    if (next.type === 'building') panel.show('building');
    else if (next.type === 'facility') panel.show('upgrades');
  }

  const ctx: UIContext = {
    catalog: deps.catalog,
    commands: deps.commands,
    saves: deps.saves,
    tr,
    select(next) {
      if (sameSelection(selection, next)) return;
      setCurrent(next);
      follow(next);
      deps.onSelectionChange(next);
      render();
    },
    run(result: CommandResult) {
      if (!result.ok) notify('error', () => tr.tx(keys.error(result.reason)));
      return result.ok;
    },
    notify,
  };

  const menu = createSaveMenu(ctx, () => render());
  const settings = createSettingsMenu(ctx, () => render());
  // Both popovers share one spot, so opening one closes the other.
  const topBar = createTopBar(
    ctx,
    () => {
      settings.close();
      menu.toggle();
    },
    () => {
      menu.close();
      settings.toggle();
    },
  );
  const panel = createSidePanel(ctx, () => render());
  const buildModal = createBuildModal(ctx, () => render());
  const hoverCard = createHoverCard(ctx);
  const statsModal = createStatsModal(ctx, () => render());
  const statsPanel = createStatsPanel(ctx, () => statsModal.open(), () => render());

  root.classList.add('wt-ui');
  root.append(topBar.el, menu.el, settings.el, statsPanel.el, panel.el, toasts.el, hoverCard.el, buildModal.el, statsModal.el);

  // Clicking anywhere outside an open popover closes it.
  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (menu.isOpen() && !menu.el.contains(target) && !topBar.savesButton.contains(target)) menu.close();
    if (settings.isOpen() && !settings.el.contains(target) && !topBar.settingsButton.contains(target)) settings.close();
  };
  document.addEventListener('pointerdown', onPointerDown);
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    if (statsModal.isOpen()) statsModal.close();
    else if (buildModal.isOpen()) buildModal.dismiss();
  };
  document.addEventListener('keydown', onKeyDown);

  /**
   * Keeps the selection valid as the world changes: a selected plot that got
   * a building becomes that building, and a building that is gone falls back
   * to nothing. The app is told, so the 3D highlight follows.
   */
  function reconcileSelection(snapshot: GameSnapshot): void {
    let next: Selection = selection;
    if (selection.type === 'plot') {
      const plotId = selection.plotId;
      const buildingId = snapshot.island.plots.find((plot) => plot.id === plotId)?.buildingId;
      if (buildingId && buildingId !== plotWasOccupiedBy) next = { type: 'building', buildingId };
      else if (!buildingId) plotWasOccupiedBy = null;
    } else if (selection.type === 'building') {
      const buildingId = selection.buildingId;
      if (!snapshot.island.buildings.some((building) => building.id === buildingId)) next = { type: 'none' };
    }
    if (sameSelection(selection, next)) return;
    setCurrent(next);
    follow(next);
    deps.onSelectionChange(next);
  }

  function render(): void {
    if (disposed || !last) return;
    const unlocks = new Map<string, UnlockView>(last.unlocks.map((unlock) => [unlock.id, unlock]));
    const frame: Frame = { snapshot: last, unlocks, selection };
    topBar.update(last, menu.isOpen(), settings.isOpen());
    settings.update(last);
    panel.update(frame);
    buildModal.update(frame);
    statsPanel.update(frame);
    statsModal.update(frame);
    hoverCard.update(frame);
  }

  const stopListening = i18n.onChange((language) => {
    root.lang = language;
    render();
    menu.rerender();
    settings.rerender();
    toasts.rerender();
  });
  root.lang = i18n.language;

  return {
    update(snapshot: GameSnapshot): void {
      last = snapshot;
      reconcileSelection(snapshot);
      render();
    },
    setSelection(next: Selection): void {
      // Comes from the app (a click in the 3D view), so it is not reported back.
      if (sameSelection(selection, next)) return;
      setCurrent(next);
      follow(next);
      render();
    },
    setHover(target: PickTarget | null, clientX: number, clientY: number): void {
      hoverCard.set(target, clientX, clientY);
      render();
    },
    handleEvents(events: GameEvent[]): void {
      for (const event of events) {
        if (event.type === 'unlocked') {
          const { unlockId } = event;
          notify('good', () => tr.t('notice.unlocked', { name: unlockName(tr, unlockId) }));
        } else if (event.type === 'specialCargoCollected') {
          const { reward } = event;
          notify('good', () => tr.t('notice.specialCargo', { amount: formatAmount(reward) }));
        }
      }
    },
    showAwayNotice(earned: BigNum, awaySeconds: number): void {
      toasts.push(
        'good',
        () => tr.t('notice.away', { amount: formatAmount(earned), time: formatDuration(awaySeconds) }),
        { title: () => tr.t('notice.awayTitle'), ttlMs: AWAY_NOTICE_TTL_MS },
      );
    },
    dispose(): void {
      disposed = true;
      stopListening();
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      menu.dispose();
      settings.dispose();
      toasts.dispose();
      topBar.el.remove();
      panel.el.remove();
      buildModal.el.remove();
      statsPanel.el.remove();
      statsModal.el.remove();
      hoverCard.el.remove();
      root.classList.remove('wt-ui');
    },
  };
}
