import type { FacilityView, UpgradeView } from '@/contracts';
import { formatDuration, formatNumber } from '@/core/format';
import type { Frame, UIContext } from './context';
import { button, h, KeyedList, setAttr, setClass, setDisabled, setHidden, setText, type Row } from './dom';
import { channelName, formatAmount, formatList, itemName, missingRequirements, unlockName } from './text';
import { createUpgradeRow } from './upgradeRow';

/** The entry after the facilities: upgrades that apply to the whole game. */
const GLOBAL = 'global';

interface PickItem {
  id: string;
  label: string;
  active: boolean;
  locked: boolean;
}

/**
 * Upgrades of the inbound yard and the sale channels, one at a time: the one
 * clicked in the 3D view or picked from the row of buttons, so nothing needs
 * scrolling. The last button holds the upgrades for the whole game.
 */
export function createLogisticsTab(ctx: UIContext, onChange: () => void) {
  const { tr, catalog } = ctx;
  /** Shown when no facility is selected in the 3D view. */
  let fallback: string | null = null;
  let channelId = '';

  const pickBar = h('div', 'wt-tabs wt-subtabs');
  const picks = new KeyedList<PickItem>(
    pickBar,
    (item) => item.id,
    (first): Row<PickItem> => {
      const { id } = first;
      const el = button('wt-tab-btn', () => {
        fallback = id;
        // Picking a facility here selects it in the 3D view too; the whole-game entry has nothing to select.
        ctx.select(id === GLOBAL ? { type: 'none' } : { type: 'facility', facilityId: id });
        onChange();
      });
      return {
        el,
        update(item) {
          setText(el, item.label);
          setClass(el, 'is-active', item.active);
          setClass(el, 'is-locked', item.locked);
        },
      };
    },
  );

  const bonus = h('span', 'wt-badge');
  const next = h('span', 'wt-facility-next');
  const stock = h('span', 'wt-facility-stock');
  const requires = h('span', 'wt-requires');
  const unlock = button('wt-btn wt-btn-buy', () => {
    const unlockId = catalog.saleChannels[channelId]?.unlock;
    if (unlockId) ctx.run(ctx.commands.unlock(unlockId));
  });
  const info = h('div', 'wt-detail-bar', bonus, next, stock, requires, unlock);

  const upgradeBox = h('div', 'wt-list');
  const upgrades = new KeyedList<UpgradeView>(
    upgradeBox,
    (view) => view.trackId,
    () => createUpgradeRow(ctx, (trackId) => ctx.run(ctx.commands.upgradeChannel(channelId, trackId))),
  );
  const globalBox = h('div', 'wt-list');
  const global = new KeyedList<UpgradeView>(
    globalBox,
    (view) => view.trackId,
    () => createUpgradeRow(ctx, (trackId) => ctx.run(ctx.commands.upgradeGlobal(trackId))),
  );
  const el = h('div', 'wt-tab', pickBar, info, upgradeBox, globalBox);

  function showFacility(facility: FacilityView, frame: Frame): void {
    channelId = facility.channelId;
    const sale = catalog.saleChannels[channelId];
    setHidden(bonus, !sale);
    setText(bonus, sale ? tr.t('logistics.priceBonus', { value: formatNumber(sale.priceMultiplier) }) : '');

    setHidden(next, !facility.unlocked || facility.nextArrivalSec === null);
    setText(
      next,
      facility.nextArrivalSec === null ? '' : tr.t('logistics.nextArrival', { time: formatDuration(facility.nextArrivalSec) }),
    );

    const held = facility.stock.filter((entry) => entry.amount.toNumber() > 0);
    setHidden(stock, !facility.unlocked);
    const heldText = formatList(tr, held.map((entry) => `${itemName(tr, entry.item)} ${formatAmount(entry.amount)}`));
    setText(stock, held.length === 0 ? tr.t('hover.stockEmpty') : `${tr.t('hover.stock')}: ${heldText}`);
    setAttr(stock, 'title', held.length === 0 ? null : heldText);

    const unlockId = sale?.unlock ?? null;
    const unlockView = unlockId ? frame.unlocks.get(unlockId) : undefined;
    setHidden(unlock, facility.unlocked);
    setText(unlock, unlockView ? tr.t('unlocks.buy', { cost: formatAmount(unlockView.cost) }) : tr.t('common.locked'));
    setDisabled(unlock, !unlockView || !unlockView.available || !unlockView.affordable);
    const missing =
      facility.unlocked || !unlockId
        ? []
        : missingRequirements(catalog, unlockId, (id) => frame.unlocks.get(id)?.unlocked ?? false);
    setHidden(requires, missing.length === 0);
    setText(
      requires,
      missing.length === 0 ? '' : tr.t('unlocks.requires', { names: formatList(tr, missing.map((id) => unlockName(tr, id))) }),
    );

    setHidden(upgradeBox, !facility.unlocked);
    if (facility.unlocked) upgrades.sync(facility.upgrades);
  }

  return {
    el,
    update(frame: Frame): void {
      // Facilities without a channel (nothing to upgrade or unlock) are not listed.
      const facilities = frame.snapshot.island.facilities.filter((facility) => facility.channelId !== '');
      const hasGlobal = frame.snapshot.globalUpgrades.length > 0;
      const selectedId = frame.selection.type === 'facility' ? frame.selection.facilityId : null;
      // What is selected in the 3D view wins; otherwise the last pick stays, starting with the first facility.
      if (selectedId && facilities.some((facility) => facility.id === selectedId)) fallback = selectedId;
      const known = fallback === GLOBAL ? hasGlobal : facilities.some((facility) => facility.id === fallback);
      const shownId = known ? fallback : (facilities[0]?.id ?? (hasGlobal ? GLOBAL : null));
      const facility = facilities.find((entry) => entry.id === shownId) ?? null;

      picks.sync([
        ...facilities.map((entry) => ({
          id: entry.id,
          label: channelName(tr, entry.channelId),
          active: entry.id === shownId,
          locked: !entry.unlocked,
        })),
        ...(hasGlobal ? [{ id: GLOBAL, label: tr.t('logistics.global'), active: shownId === GLOBAL, locked: false }] : []),
      ]);

      setHidden(info, facility === null);
      setHidden(upgradeBox, facility === null);
      setHidden(globalBox, shownId !== GLOBAL);
      if (facility) showFacility(facility, frame);
      else if (shownId === GLOBAL) global.sync(frame.snapshot.globalUpgrades);
    },
  };
}
