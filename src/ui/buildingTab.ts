import type { BuildingView, UpgradeView } from '@/contracts';
import { keys } from '@/i18n';
import type { Frame, UIContext } from './context';
import { createConfirm, h, KeyedList, setAttr, setHidden, setText } from './dom';
import { buildingName, formatAmount, formatBuildingStatus, wasteLevel } from './text';
import { createUpgradeRow } from './upgradeRow';

/**
 * Upgrades of the selected building. What the building holds and makes is
 * shown by the hover card instead, so this stays short enough for the dock.
 */
export function createBuildingTab(ctx: UIContext) {
  const { tr, catalog } = ctx;
  let current: BuildingView | null = null;

  const empty = h('p', 'wt-hint');
  const title = h('h3', 'wt-detail-title');
  const category = h('span', 'wt-badge');
  const statusDot = h('span', 'wt-dot');
  const statusText = h('span', 'wt-status-text');

  const upgradeBox = h('div', 'wt-list');
  const upgrades = new KeyedList<UpgradeView>(
    upgradeBox,
    (view) => view.trackId,
    () =>
      createUpgradeRow(ctx, (trackId) => {
        if (current) ctx.run(ctx.commands.upgradeBuilding(current.id, trackId));
      }),
  );

  const invested = h('div', 'wt-invested');
  const demolish = createConfirm('wt-btn-danger-soft', () => {
    if (current && ctx.run(ctx.commands.demolish(current.id))) ctx.select({ type: 'none' });
  });

  const detail = h(
    'div',
    'wt-detail',
    h(
      'div',
      'wt-detail-bar',
      h('div', 'wt-detail-head', title, category),
      h('div', 'wt-status', statusDot, statusText),
      h('div', 'wt-detail-foot', invested, demolish.el),
    ),
    upgradeBox,
  );
  const el = h('div', 'wt-tab', empty, detail);

  return {
    el,
    update(frame: Frame): void {
      const { buildings } = frame.snapshot.island;
      const selectedId = frame.selection.type === 'building' ? frame.selection.buildingId : null;
      const building = buildings.find((entry) => entry.id === selectedId) ?? null;
      if (building?.id !== current?.id) demolish.disarm();
      current = building;
      setHidden(detail, building === null);
      setHidden(empty, building !== null);
      setText(empty, buildings.length === 0 ? tr.t('detail.none') : tr.t('detail.empty'));
      if (!building) return;

      const def = catalog.buildings[building.typeId];
      setText(title, buildingName(tr, building.typeId));
      setText(category, def ? tr.tx(keys.categoryName(def.category)) : '');
      const clogged = wasteLevel(building.wasteRatio) === 'clogged';
      setAttr(statusDot, 'data-status', clogged ? 'clogged' : building.status);
      setText(statusText, formatBuildingStatus(tr, building));

      upgrades.sync(building.upgrades);

      setText(invested, tr.t('detail.invested', { amount: formatAmount(building.invested) }));
      const refund = formatAmount(building.refund);
      demolish.render({
        label: tr.t('detail.demolish', { amount: refund }),
        question: tr.t('detail.demolishConfirm', { amount: refund }),
        yes: tr.t('common.confirm'),
        no: tr.t('common.cancel'),
      });
    },
  };
}
