import { formatDuration, formatNumber } from '@/core/format';
import { keys } from '@/i18n';
import type { Frame, UIContext } from './context';
import { button, h, KeyedList, setAttr, setFill, setHidden, setText, type Row } from './dom';
import { buildingName, channelName, formatAmount, formatIncome, formatPercent, itemName } from './text';

/** Rows shown in a ranking before the rest is left out. */
const TOP = 8;

interface BarItem {
  id: string;
  label: string;
  value: string;
  /** 0..1, the length of the bar. */
  share: number;
}

interface FactItem {
  id: string;
  label: string;
  value: string;
}

/** The window with every figure: summary numbers, buildings by type, shortages and sales. */
export function createStatsModal(ctx: UIContext, onChange: () => void) {
  const { tr, catalog } = ctx;
  let open = false;
  const close = (): void => {
    open = false;
    onChange();
  };

  const barRow = (): Row<BarItem> => {
    const label = h('span');
    const value = h('span', 'wt-stats-value');
    const fill = h('div', 'wt-bar-fill');
    const el = h('div', 'wt-stock', h('div', 'wt-stock-head', label, value), h('div', 'wt-bar wt-bar-thin', fill));
    return {
      el,
      update(item) {
        setText(label, item.label);
        setText(value, item.value);
        setFill(fill, item.share);
      },
    };
  };
  const section = (className = '') => {
    const title = h('div', 'wt-section-title');
    const empty = h('div', 'wt-hover-note');
    const box = h('div', 'wt-stocks');
    const list = new KeyedList<BarItem>(box, (item) => item.id, barRow);
    return {
      el: h('section', `wt-stats-section ${className}`, title, empty, box),
      set(heading: string, items: BarItem[]): void {
        setText(title, heading);
        setHidden(empty, items.length > 0);
        setText(empty, tr.t('stats.noData'));
        list.sync(items);
      },
    };
  };

  const title = h('div', 'wt-menu-title');
  const closeButton = button('wt-icon-btn', close);
  setText(closeButton, '×');

  const factBox = h('div', 'wt-stats-facts');
  const facts = new KeyedList<FactItem>(
    factBox,
    (item) => item.id,
    (): Row<FactItem> => {
      const label = h('div', 'wt-stats-fact-label');
      const value = h('div', 'wt-stats-fact-value');
      return {
        el: h('div', 'wt-stats-fact', label, value),
        update(item) {
          setText(label, item.label);
          setText(value, item.value);
        },
      };
    },
  );
  const byType = section('wt-stats-wide');
  const shortages = section();
  const salesByItem = section();
  const salesByChannel = section();

  const card = h(
    'div',
    'wt-build-modal wt-stats-modal wt-card',
    h('div', 'wt-menu-head', h('div', 'wt-build-title', title), closeButton),
    h('div', 'wt-stats-scroll', factBox, h('div', 'wt-stats-grid', byType.el, shortages.el, salesByItem.el, salesByChannel.el)),
  );
  card.setAttribute('role', 'dialog');
  const el = h('div', 'wt-backdrop', card);
  el.addEventListener('pointerdown', (event) => {
    if (event.target === el) close();
  });
  el.hidden = true;

  /** Bars as shares of the largest entry, with each entry's share of the total as its value. */
  const ranked = (entries: Array<{ id: string; label: string; amount: number; text: string }>): BarItem[] => {
    const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const top = Math.max(...entries.map((entry) => entry.amount), 0);
    return entries.slice(0, TOP).map((entry) => ({
      id: entry.id,
      label: entry.label,
      value: total > 0 ? `${entry.text} · ${formatPercent(entry.amount / total)}%` : entry.text,
      share: top > 0 ? entry.amount / top : 0,
    }));
  };

  return {
    el,
    isOpen: (): boolean => open,
    open(): void {
      open = true;
      onChange();
    },
    close,
    update(frame: Frame): void {
      setHidden(el, !open);
      if (!open) return;
      const { snapshot } = frame;
      const island = snapshot.island;
      const stats = island.stats;
      setText(title, tr.t('stats.detailsTitle'));
      setAttr(closeButton, 'aria-label', tr.t('common.close'));
      setAttr(closeButton, 'title', tr.t('common.close'));

      const levels = (upgrades: ReadonlyArray<{ level: number }>): number => upgrades.reduce((sum, upgrade) => sum + upgrade.level, 0);
      const bought =
        island.buildings.reduce((sum, building) => sum + levels(building.upgrades), 0) +
        island.facilities.reduce((sum, facility) => sum + levels(facility.upgrades), 0) +
        levels(snapshot.globalUpgrades);
      facts.sync([
        { id: 'income', label: tr.t('stats.income'), value: formatIncome(tr, snapshot.incomePerSec) },
        { id: 'earned', label: tr.t('stats.totalEarned'), value: formatAmount(snapshot.totalEarned) },
        { id: 'time', label: tr.t('stats.playTime'), value: formatDuration(snapshot.playSeconds) },
        { id: 'buildings', label: tr.t('stats.buildingCount'), value: `${island.buildings.length}/${island.maxBuildings}` },
        {
          id: 'uptime',
          label: tr.t('stats.averageUptime'),
          value: stats.averageUptime === null ? '–' : `${formatPercent(stats.averageUptime)}%`,
        },
        { id: 'upgrades', label: tr.t('stats.upgrades'), value: formatNumber(bought) },
        { id: 'vehicles', label: tr.t('stats.vehicles'), value: formatNumber(island.vehicles.length) },
        {
          id: 'unlocks',
          label: tr.t('stats.unlocks'),
          value: `${snapshot.unlocks.filter((unlock) => unlock.unlocked).length}/${snapshot.unlocks.length}`,
        },
      ]);

      // Every type that has been built: how many stand and how much they worked on average.
      byType.set(
        tr.t('stats.byType'),
        island.buildOptions
          .filter((option) => option.builtCount > 0)
          .map((option) => {
            const measured = island.buildings.filter((building) => building.typeId === option.typeId && building.uptime !== null);
            const uptime = measured.length > 0 ? measured.reduce((sum, building) => sum + (building.uptime ?? 0), 0) / measured.length : null;
            const def = catalog.buildings[option.typeId];
            const category = def ? tr.tx(keys.categoryName(def.category)) : '';
            return {
              id: option.typeId,
              label: `${buildingName(tr, option.typeId)} · ${category} · ${option.builtCount}/${option.maxCount}`,
              value: uptime === null ? '–' : `${formatPercent(uptime)}%`,
              share: uptime ?? 0,
            };
          }),
      );

      shortages.set(
        tr.t('stats.shortages'),
        ranked(
          stats.shortages.map((entry) => ({
            id: entry.item,
            label: itemName(tr, entry.item),
            amount: entry.seconds,
            text: formatDuration(entry.seconds),
          })),
        ),
      );
      salesByItem.set(
        tr.t('stats.salesByItem'),
        ranked(
          stats.salesByItem.map((entry) => ({
            id: entry.item,
            label: itemName(tr, entry.item),
            amount: entry.amount.toNumber(),
            text: formatAmount(entry.amount),
          })),
        ),
      );
      salesByChannel.set(
        tr.t('stats.salesByChannel'),
        ranked(
          stats.salesByChannel.map((entry) => ({
            id: entry.channelId,
            label: channelName(tr, entry.channelId),
            amount: entry.amount.toNumber(),
            text: formatAmount(entry.amount),
          })),
        ),
      );
    },
  };
}
