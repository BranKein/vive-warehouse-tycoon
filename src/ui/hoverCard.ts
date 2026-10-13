import {
  Stat,
  type BuildingView,
  type FacilityView,
  type ModifierView,
  type PickTarget,
  type StockView,
  type UpgradeView,
} from '@/contracts';
import { formatDuration, formatNumber } from '@/core/format';
import { keys } from '@/i18n';
import type { Frame, UIContext } from './context';
import { h, KeyedList, setAttr, setClass, setFill, setHidden, setText, type Row } from './dom';
import {
  buildingName,
  channelName,
  fillRatio,
  formatBuildingStatus,
  formatModifier,
  formatPercent,
  formatRecipeSide,
  formatStock,
  formatWaste,
  itemName,
  wasteLevel,
} from './text';

/** Gap between the pointer and the card, and between the card and the window edge. */
const OFFSET = 18;
const MARGIN = 10;
/** Stock rows shown for a facility before the rest is summed up in one line. */
const MAX_STOCK_ROWS = 8;

const statOf = (upgrades: readonly UpgradeView[], stat: string): number | null => {
  const view = upgrades.find((upgrade) => upgrade.stat === stat);
  return view ? view.current.toNumber() : null;
};

interface RateItem {
  item: string;
  perSec: number;
}

/**
 * The card that follows the pointer over the 3D view. It carries the details
 * that are not in the dock: what a building makes and holds, and what moves
 * through a yard, the dock or the airport.
 */
export function createHoverCard(ctx: UIContext) {
  const { tr, catalog } = ctx;
  let target: PickTarget | null = null;
  let pointerX = 0;
  let pointerY = 0;

  const title = h('div', 'wt-hover-title');
  const badge = h('span', 'wt-badge');
  const statusDot = h('span', 'wt-dot');
  const statusText = h('span', 'wt-status-text');
  const status = h('div', 'wt-status', statusDot, statusText);
  const progressFill = h('div', 'wt-bar-fill');
  const progress = h('div', 'wt-bar wt-bar-thin', progressFill);
  const line = h('div', 'wt-hover-line');
  const note = h('div', 'wt-hover-note');

  const rateTitle = h('div', 'wt-section-title');
  const rateBox = h('div', 'wt-hover-rates');
  const rates = new KeyedList<RateItem>(
    rateBox,
    (rate) => rate.item,
    (): Row<RateItem> => {
      const el = h('span', 'wt-item');
      return {
        el,
        update(rate) {
          setText(el, tr.t('hover.rateItem', { name: itemName(tr, rate.item), rate: formatNumber(rate.perSec) }));
          setAttr(el, 'data-kind', catalog.items[rate.item]?.kind ?? null);
        },
      };
    },
  );

  const stockRow = (): Row<StockView> => {
    const name = h('span', 'wt-stock-name');
    const amount = h('span', 'wt-stock-amount');
    const fill = h('div', 'wt-bar-fill');
    const bar = h('div', 'wt-bar wt-bar-thin', fill);
    const el = h('div', 'wt-stock', h('div', 'wt-stock-head', name, amount), bar);
    return {
      el,
      update(stock) {
        setText(name, itemName(tr, stock.item));
        setText(amount, formatStock(tr, stock.amount, stock.capacity));
        setHidden(bar, stock.capacity === null);
        setFill(fill, fillRatio(stock.amount, stock.capacity));
      },
    };
  };
  const stockSection = (): { el: HTMLElement; title: HTMLElement; list: KeyedList<StockView> } => {
    const sectionTitle = h('div', 'wt-section-title');
    const box = h('div', 'wt-stocks');
    return { el: h('div', 'wt-hover-section', sectionTitle, box), title: sectionTitle, list: new KeyedList(box, (stock) => stock.item, stockRow) };
  };
  const inputs = stockSection();
  const outputs = stockSection();
  const waste = stockSection();
  const more = h('div', 'wt-hover-note');

  const modifierBox = h('div', 'wt-modifiers');
  const modifiers = new KeyedList<ModifierView>(
    modifierBox,
    (modifier) => `${modifier.source}:${modifier.stat}`,
    (): Row<ModifierView> => {
      const el = h('div', 'wt-modifier');
      return { el, update: (modifier) => setText(el, formatModifier(tr, modifier)) };
    },
  );
  const hint = h('div', 'wt-hover-hint');

  const rateSection = h('div', 'wt-hover-section', rateTitle, rateBox);
  const el = h(
    'div',
    'wt-hover wt-card',
    h('div', 'wt-hover-head', title, badge),
    status,
    progress,
    line,
    note,
    rateSection,
    inputs.el,
    outputs.el,
    more,
    waste.el,
    modifierBox,
    hint,
  );
  el.hidden = true;
  const optional = [badge, status, progress, line, note, rateSection, inputs.el, outputs.el, more, waste.el, modifierBox, hint];

  function showBuilding(building: BuildingView): void {
    const def = catalog.buildings[building.typeId];
    const recipe = def ? catalog.recipes[def.recipe] : undefined;
    setText(title, buildingName(tr, building.typeId));
    setHidden(badge, !def);
    setText(badge, def ? tr.tx(keys.categoryName(def.category)) : '');

    const clogged = wasteLevel(building.wasteRatio) === 'clogged';
    setHidden(status, false);
    setAttr(statusDot, 'data-status', clogged ? 'clogged' : building.status);
    setText(statusText, formatBuildingStatus(tr, building));
    setHidden(note, building.uptime === null);
    if (building.uptime !== null) setText(note, tr.t('stats.uptimeValue', { percent: formatPercent(building.uptime) }));
    setHidden(progress, false);
    setFill(progressFill, building.progress);
    setClass(progress, 'is-paused', building.status !== 'working');

    setHidden(line, !recipe);
    if (recipe) {
      setText(line, `${formatRecipeSide(tr, recipe.inputs)} ${tr.t('recipe.arrow')} ${formatRecipeSide(tr, recipe.outputs)}`);
    }

    // What it turns out per second while it keeps working, with its upgrades and penalties.
    const batch = statOf(building.upgrades, Stat.batchSize) ?? 1;
    const slowed = building.modifiers
      .filter((modifier) => modifier.stat === Stat.cycleSpeed)
      .reduce((product, modifier) => product * modifier.multiplier, 1);
    const speed = (statOf(building.upgrades, Stat.cycleSpeed) ?? 1) * slowed;
    const made = (recipe?.outputs ?? []).filter((io) => catalog.items[io.item]?.kind !== 'waste');
    setHidden(rateSection, !recipe || made.length === 0);
    setText(rateTitle, tr.t('hover.rate'));
    rates.sync(recipe ? made.map((io) => ({ item: io.item, perSec: (io.amount * batch * speed) / recipe.durationSec })) : []);

    setHidden(inputs.el, building.inputs.length === 0);
    setText(inputs.title, tr.t('detail.inputs'));
    inputs.list.sync(building.inputs);
    setHidden(outputs.el, building.outputs.length === 0);
    setText(outputs.title, tr.t('detail.outputs'));
    outputs.list.sync(building.outputs);

    const level = wasteLevel(building.wasteRatio);
    setHidden(waste.el, building.waste.length === 0 && level === 'none');
    setText(waste.title, `${tr.t('waste.title')} · ${formatWaste(tr, building.wasteRatio)}`);
    waste.list.sync(building.waste);

    setHidden(modifierBox, building.modifiers.length === 0);
    modifiers.sync(building.modifiers);
    setHidden(hint, false);
    setText(hint, tr.t('hover.buildingHint'));
  }

  function showFacility(facility: FacilityView): void {
    const sale = catalog.saleChannels[facility.channelId];
    setText(title, channelName(tr, facility.channelId));
    setHidden(badge, !sale);
    setText(badge, sale ? tr.t('logistics.priceBonus', { value: formatNumber(sale.priceMultiplier) }) : '');
    if (!facility.unlocked) {
      setHidden(line, false);
      setText(line, tr.t('common.locked'));
      return;
    }

    const load = statOf(facility.upgrades, Stat.load);
    const interval = statOf(facility.upgrades, Stat.interval);
    if (load !== null && interval !== null && interval > 0) {
      setHidden(line, false);
      setText(line, tr.t('hover.capacity', { load: formatNumber(load), interval: formatNumber(interval) }));
      setHidden(note, false);
      const rate = formatNumber(load / interval);
      const arrival =
        facility.nextArrivalSec === null ? '' : ` · ${tr.t('logistics.nextArrival', { time: formatDuration(facility.nextArrivalSec) })}`;
      setText(note, `${tr.t(sale ? 'hover.outRate' : 'hover.inRate', { rate })}${arrival}`);
    }

    const held = facility.stock.filter((stock) => stock.amount.toNumber() > 0);
    const shown = held.slice(0, MAX_STOCK_ROWS);
    setHidden(inputs.el, false);
    setText(inputs.title, held.length === 0 ? tr.t('hover.stockEmpty') : tr.t('hover.stock'));
    inputs.list.sync(shown);
    setHidden(more, held.length <= shown.length);
    setText(more, tr.t('hover.more', { count: held.length - shown.length }));
  }

  /** Keeps the card beside the pointer and inside the window. */
  function place(): void {
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const maxLeft = window.innerWidth - width - MARGIN;
    const maxTop = window.innerHeight - height - MARGIN;
    let left = pointerX + OFFSET;
    if (left > maxLeft) left = pointerX - OFFSET - width;
    let top = pointerY + OFFSET;
    if (top > maxTop) top = pointerY - OFFSET - height;
    el.style.left = `${Math.max(MARGIN, Math.min(left, maxLeft))}px`;
    el.style.top = `${Math.max(MARGIN, Math.min(top, maxTop))}px`;
  }

  return {
    el,
    set(next: PickTarget | null, clientX: number, clientY: number): void {
      target = next;
      pointerX = clientX;
      pointerY = clientY;
    },
    update(frame: Frame): void {
      const island = frame.snapshot.island;
      const over = target;
      const building = over?.type === 'building' ? island.buildings.find((entry) => entry.id === over.buildingId) : undefined;
      const facility = over?.type === 'facility' ? island.facilities.find((entry) => entry.id === over.facilityId) : undefined;
      const visible = building !== undefined || (facility !== undefined && facility.channelId !== '');
      setHidden(el, !visible);
      if (!visible) return;

      for (const part of optional) setHidden(part, true);
      if (building) showBuilding(building);
      else if (facility) showFacility(facility);
      place();
    },
  };
}
