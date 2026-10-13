import type { FacilityView, UpgradeView } from '@/contracts';
import { formatDuration, formatNumber } from '@/core/format';
import type { Frame, UIContext } from './context';
import { button, h, KeyedList, setClass, setDisabled, setHidden, setText, type Row } from './dom';
import { channelName, formatAmount, formatList, itemName, missingRequirements, unlockName } from './text';
import { createUpgradeRow } from './upgradeRow';

interface FacilityItem {
  facility: FacilityView;
  frame: Frame;
}

export function createLogisticsTab(ctx: UIContext) {
  const { tr, catalog } = ctx;
  let scrollTo: string | null = null;

  const facilityRow = (first: FacilityItem): Row<FacilityItem> => {
    const facilityId = first.facility.id;
    let channelId = first.facility.channelId;
    const name = h('span', 'wt-facility-name');
    const bonus = h('span', 'wt-badge');
    const next = h('div', 'wt-facility-next');
    const stock = h('div', 'wt-facility-stock');
    const requires = h('div', 'wt-requires');
    const unlock = button('wt-btn wt-btn-buy', () => {
      const unlockId = catalog.saleChannels[channelId]?.unlock;
      if (unlockId) ctx.run(ctx.commands.unlock(unlockId));
    });
    const upgradeBox = h('div', 'wt-list');
    const upgrades = new KeyedList<UpgradeView>(
      upgradeBox,
      (view) => view.trackId,
      () => createUpgradeRow(ctx, (trackId) => ctx.run(ctx.commands.upgradeChannel(channelId, trackId))),
    );
    const head = button('wt-facility-head', () => ctx.select({ type: 'facility', facilityId }), name, bonus);
    const el = h('section', 'wt-facility', head, next, stock, requires, unlock, upgradeBox);
    return {
      el,
      update({ facility, frame }) {
        channelId = facility.channelId;
        const sale = catalog.saleChannels[channelId];
        setText(name, channelName(tr, channelId));
        setHidden(bonus, !sale);
        setText(bonus, sale ? tr.t('logistics.priceBonus', { value: formatNumber(sale.priceMultiplier) }) : '');

        const selected = frame.selection.type === 'facility' && frame.selection.facilityId === facilityId;
        setClass(el, 'is-selected', selected);
        setClass(el, 'is-locked', !facility.unlocked);
        if (selected && scrollTo === facilityId) {
          scrollTo = null;
          el.scrollIntoView({ block: 'start' });
        }

        setHidden(next, !facility.unlocked || facility.nextArrivalSec === null);
        setText(
          next,
          facility.nextArrivalSec === null
            ? ''
            : tr.t('logistics.nextArrival', { time: formatDuration(facility.nextArrivalSec) }),
        );

        const held = facility.stock.filter((entry) => entry.amount.toNumber() > 0);
        setHidden(stock, !facility.unlocked);
        setText(
          stock,
          held.length === 0
            ? tr.t('hover.stockEmpty')
            : `${tr.t('hover.stock')}: ${formatList(tr, held.map((entry) => `${itemName(tr, entry.item)} ${formatAmount(entry.amount)}`))}`,
        );

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
      },
    };
  };

  const inboundTitle = h('div', 'wt-section-title');
  const inboundBox = h('div', 'wt-facilities');
  const saleTitle = h('div', 'wt-section-title');
  const saleBox = h('div', 'wt-facilities');
  const globalTitle = h('div', 'wt-section-title');
  const globalBox = h('div', 'wt-list');
  const inbound = new KeyedList<FacilityItem>(inboundBox, (item) => item.facility.id, facilityRow);
  const sale = new KeyedList<FacilityItem>(saleBox, (item) => item.facility.id, facilityRow);
  const global = new KeyedList<UpgradeView>(
    globalBox,
    (view) => view.trackId,
    () => createUpgradeRow(ctx, (trackId) => ctx.run(ctx.commands.upgradeGlobal(trackId))),
  );
  const el = h('div', 'wt-tab', inboundTitle, inboundBox, saleTitle, saleBox, globalTitle, globalBox);

  return {
    el,
    /** Scrolls the given facility into view on the next update. */
    reveal(facilityId: string): void {
      scrollTo = facilityId;
    },
    update(frame: Frame): void {
      // Facilities without a channel (nothing to upgrade or unlock) are not listed.
      const items = frame.snapshot.island.facilities
        .filter((facility) => facility.channelId !== '')
        .map((facility) => ({ facility, frame }));
      setText(inboundTitle, tr.t('logistics.inbound'));
      setText(saleTitle, tr.t('logistics.sale'));
      setText(globalTitle, tr.t('logistics.global'));
      inbound.sync(items.filter((item) => item.facility.kind === 'inboundYard'));
      sale.sync(items.filter((item) => item.facility.kind !== 'inboundYard'));
      global.sync(frame.snapshot.globalUpgrades);
      setHidden(globalTitle, frame.snapshot.globalUpgrades.length === 0);
    },
  };
}
