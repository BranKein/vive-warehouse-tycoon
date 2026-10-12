import type { BuildingView, ModifierView, RecipeIO, StockView, UpgradeView } from '@/contracts';
import { formatNumber } from '@/core/format';
import { keys } from '@/i18n';
import type { Frame, UIContext } from './context';
import { button, createConfirm, h, KeyedList, setAttr, setClass, setFill, setHidden, setText, type Row } from './dom';
import {
  buildingName,
  fillRatio,
  formatAmount,
  formatBuildingStatus,
  formatModifier,
  formatStock,
  formatWaste,
  itemName,
  wasteLevel,
} from './text';
import { createUpgradeRow } from './upgradeRow';

interface ChipItem {
  building: BuildingView;
  selected: boolean;
}

export function createBuildingTab(ctx: UIContext) {
  const { tr, catalog } = ctx;
  let current: BuildingView | null = null;

  // Every building as a small button, so one can be picked without the 3D view.
  const chipBox = h('div', 'wt-chips');
  const chips = new KeyedList<ChipItem>(
    chipBox,
    (item) => item.building.id,
    (first): Row<ChipItem> => {
      const buildingId = first.building.id;
      const dot = h('span', 'wt-dot');
      const label = h('span');
      const chip = button('wt-chip', () => ctx.select({ type: 'building', buildingId }), dot, label);
      return {
        el: chip,
        update({ building, selected }) {
          setText(label, buildingName(tr, building.typeId));
          setAttr(dot, 'data-status', building.wasteRatio >= 1 ? 'clogged' : building.status);
          setAttr(chip, 'title', formatBuildingStatus(tr, building));
          setClass(chip, 'is-selected', selected);
        },
      };
    },
  );
  const empty = h('p', 'wt-hint');

  const title = h('h3', 'wt-detail-title');
  const category = h('span', 'wt-badge');
  const plot = h('span', 'wt-detail-plot');
  const desc = h('p', 'wt-detail-desc');

  const statusDot = h('span', 'wt-dot');
  const statusText = h('span', 'wt-status-text');
  const progressFill = h('div', 'wt-bar-fill');
  const progress = h('div', 'wt-bar', progressFill);

  const ioRow = (): Row<RecipeIO> => {
    const el = h('span', 'wt-item');
    return {
      el,
      update(io) {
        setText(el, tr.t('recipe.io', { name: itemName(tr, io.item), amount: formatNumber(io.amount) }));
        setAttr(el, 'data-kind', catalog.items[io.item]?.kind ?? null);
      },
    };
  };
  const recipeTitle = h('div', 'wt-section-title');
  const recipeIn = h('div', 'wt-items');
  const recipeOut = h('div', 'wt-items');
  const recipeArrow = h('span', 'wt-arrow');
  const recipeNothingIn = h('span', 'wt-item wt-item-none');
  const recipeNothingOut = h('span', 'wt-item wt-item-none');
  const recipeNote = h('div', 'wt-recipe-note');
  const recipeInputs = new KeyedList<RecipeIO>(recipeIn, (io) => io.item, ioRow);
  const recipeOutputs = new KeyedList<RecipeIO>(recipeOut, (io) => io.item, ioRow);

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
  const inputsTitle = h('div', 'wt-section-title');
  const inputsBox = h('div', 'wt-stocks');
  const outputsTitle = h('div', 'wt-section-title');
  const outputsBox = h('div', 'wt-stocks');
  const inputs = new KeyedList<StockView>(inputsBox, (stock) => stock.item, stockRow);
  const outputs = new KeyedList<StockView>(outputsBox, (stock) => stock.item, stockRow);
  const inputsSection = h('div', 'wt-half', inputsTitle, inputsBox);
  const outputsSection = h('div', 'wt-half', outputsTitle, outputsBox);

  const wasteTitle = h('div', 'wt-section-title');
  const wasteText = h('div', 'wt-waste-text');
  const wasteFill = h('div', 'wt-bar-fill');
  const wasteBox = h('div', 'wt-stocks');
  const wasteStocks = new KeyedList<StockView>(wasteBox, (stock) => stock.item, stockRow);
  const wasteSection = h('div', 'wt-waste', wasteTitle, h('div', 'wt-bar', wasteFill), wasteText, wasteBox);

  const modifierBox = h('div', 'wt-modifiers');
  const modifiers = new KeyedList<ModifierView>(
    modifierBox,
    (modifier) => `${modifier.source}:${modifier.stat}`,
    (): Row<ModifierView> => {
      const el = h('div', 'wt-modifier');
      return { el, update: (modifier) => setText(el, formatModifier(tr, modifier)) };
    },
  );

  const upgradesTitle = h('div', 'wt-section-title');
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
    if (!current) return;
    const { id, plotId } = current;
    if (ctx.run(ctx.commands.demolish(id))) ctx.select({ type: 'plot', plotId });
  });

  const detail = h(
    'div',
    'wt-detail',
    h('div', 'wt-detail-head', title, category),
    plot,
    desc,
    h('div', 'wt-status', statusDot, statusText),
    progress,
    recipeTitle,
    h('div', 'wt-recipe', recipeIn, recipeNothingIn, recipeArrow, recipeOut, recipeNothingOut),
    recipeNote,
    h('div', 'wt-halves', inputsSection, outputsSection),
    wasteSection,
    modifierBox,
    upgradesTitle,
    upgradeBox,
    h('div', 'wt-detail-foot', invested, demolish.el),
  );
  const el = h('div', 'wt-tab', chipBox, empty, detail);

  return {
    el,
    update(frame: Frame): void {
      const { buildings } = frame.snapshot.island;
      const selectedId = frame.selection.type === 'building' ? frame.selection.buildingId : null;
      chips.sync(buildings.map((building) => ({ building, selected: building.id === selectedId })));

      const building = buildings.find((entry) => entry.id === selectedId) ?? null;
      if (building?.id !== current?.id) demolish.disarm();
      current = building;
      setHidden(detail, building === null);
      setHidden(empty, building !== null);
      setText(empty, buildings.length === 0 ? tr.t('detail.none') : tr.t('detail.empty'));
      if (!building) return;

      const def = catalog.buildings[building.typeId];
      const recipe = def ? catalog.recipes[def.recipe] : undefined;
      setText(title, buildingName(tr, building.typeId));
      setText(category, def ? tr.tx(keys.categoryName(def.category)) : '');
      setText(plot, tr.t('detail.plot', { plot: building.plotId }));
      setText(desc, tr.tx(keys.buildingDesc(building.typeId), undefined, ''));

      const clogged = wasteLevel(building.wasteRatio) === 'clogged';
      setAttr(statusDot, 'data-status', clogged ? 'clogged' : building.status);
      setText(statusText, formatBuildingStatus(tr, building));
      setAttr(progress, 'aria-label', tr.t('detail.status'));
      setFill(progressFill, building.progress);
      setClass(progress, 'is-paused', building.status !== 'working');

      setText(recipeTitle, tr.t('recipe.title'));
      setText(recipeArrow, tr.t('recipe.arrow'));
      setText(recipeNothingIn, tr.t('recipe.nothing'));
      setText(recipeNothingOut, tr.t('recipe.nothing'));
      recipeInputs.sync(recipe?.inputs ?? []);
      recipeOutputs.sync(recipe?.outputs ?? []);
      setHidden(recipeNothingIn, (recipe?.inputs.length ?? 0) > 0);
      setHidden(recipeNothingOut, (recipe?.outputs.length ?? 0) > 0);
      const notes: string[] = [];
      if (recipe) {
        notes.push(tr.t('recipe.duration', { seconds: formatNumber(recipe.durationSec) }));
        if (recipe.inputMode === 'any') notes.push(tr.t('recipe.anyInput'));
        if (recipe.moneyCostPerCycle) notes.push(tr.t('recipe.fee', { amount: formatAmount(recipe.moneyCostPerCycle) }));
      }
      setText(recipeNote, notes.join(' · '));

      setText(inputsTitle, tr.t('detail.inputs'));
      setText(outputsTitle, tr.t('detail.outputs'));
      inputs.sync(building.inputs);
      outputs.sync(building.outputs);
      setHidden(inputsSection, building.inputs.length === 0);
      setHidden(outputsSection, building.outputs.length === 0);

      const level = wasteLevel(building.wasteRatio);
      setHidden(wasteSection, building.waste.length === 0 && level === 'none');
      setText(wasteTitle, tr.t('waste.title'));
      setText(wasteText, formatWaste(tr, building.wasteRatio));
      setFill(wasteFill, building.wasteRatio);
      setAttr(wasteSection, 'data-level', level);
      wasteStocks.sync(building.waste);

      modifiers.sync(building.modifiers);
      setHidden(modifierBox, building.modifiers.length === 0);

      setText(upgradesTitle, tr.t('detail.upgrades'));
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
