/**
 * The HTML overlay: top bar, side panel, save menu and notifications.
 * It reads `GameSnapshot`, calls `GameCommands` and `SaveController`, and
 * knows nothing else about the simulation or the 3D view.
 */
import type { BigNum } from '@/core/BigNum';
import { formatDuration } from '@/core/format';
import type { CommandResult, GameEvent, GameSnapshot, GameUI, Selection, UIDeps, UnlockView } from '@/contracts';
import { i18n, keys } from '@/i18n';
import type { Frame, ToastKind, UIContext } from './context';
import { createSaveMenu } from './saveMenu';
import { createSidePanel } from './sidePanel';
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

  const toasts = createToasts(tr);
  const notify = (kind: ToastKind, render: () => string): void => toasts.push(kind, render);

  /** Opens the tab that belongs to what was just selected. */
  function follow(next: Selection): void {
    if (next.type === 'plot') panel.show('build');
    else if (next.type === 'building') panel.show('building');
    else if (next.type === 'facility') {
      panel.show('upgrades');
      panel.reveal(next.facilityId);
    }
  }

  const ctx: UIContext = {
    catalog: deps.catalog,
    commands: deps.commands,
    saves: deps.saves,
    tr,
    select(next) {
      if (sameSelection(selection, next)) return;
      selection = next;
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
  const topBar = createTopBar(ctx, () => menu.toggle());
  const panel = createSidePanel(ctx, () => render());

  root.classList.add('wt-ui');
  root.append(topBar.el, menu.el, panel.el, toasts.el);

  // Clicking anywhere outside the save menu closes it.
  const onPointerDown = (event: PointerEvent): void => {
    if (!menu.isOpen() || !(event.target instanceof Node)) return;
    if (menu.el.contains(event.target) || topBar.savesButton.contains(event.target)) return;
    menu.close();
  };
  document.addEventListener('pointerdown', onPointerDown);

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
      if (buildingId) next = { type: 'building', buildingId };
    } else if (selection.type === 'building') {
      const buildingId = selection.buildingId;
      if (!snapshot.island.buildings.some((building) => building.id === buildingId)) next = { type: 'none' };
    }
    if (sameSelection(selection, next)) return;
    selection = next;
    follow(next);
    deps.onSelectionChange(next);
  }

  function render(): void {
    if (disposed || !last) return;
    const unlocks = new Map<string, UnlockView>(last.unlocks.map((unlock) => [unlock.id, unlock]));
    const frame: Frame = { snapshot: last, unlocks, selection };
    topBar.update(last, menu.isOpen());
    panel.update(frame);
  }

  const stopListening = i18n.onChange((language) => {
    root.lang = language;
    render();
    menu.rerender();
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
      selection = next;
      follow(next);
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
      menu.dispose();
      toasts.dispose();
      topBar.el.remove();
      panel.el.remove();
      root.classList.remove('wt-ui');
    },
  };
}
