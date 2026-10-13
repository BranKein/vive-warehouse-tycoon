import type { BuildOptionView, IslandLayoutDef, PlotView } from '@/contracts';
import { keys } from '@/i18n';
import type { Frame, UIContext } from './context';
import { button, h, KeyedList, setAttr, setClass, setDisabled, setHidden, setText, type Row } from './dom';
import { buildingName, formatAmount, formatRecipeSide } from './text';

interface PlotItem {
  plot: PlotView;
  selected: boolean;
  typeId: string | null;
}

interface OptionItem {
  option: BuildOptionView;
  frame: Frame;
  /** The selected plot when it is empty; building needs one. */
  targetPlot: string | null;
  full: boolean;
}

/** Places a plot button on the mini map as percentages of the area the plots cover. */
function plotRect(layout: IslandLayoutDef, plotId: string): { left: number; top: number; width: number; height: number } | null {
  const plot = layout.plots.find((entry) => entry.id === plotId);
  if (!plot) return null;
  const { width, depth } = layout.plotSize;
  const xs = layout.plots.map((entry) => entry.x);
  const zs = layout.plots.map((entry) => entry.z);
  const minX = Math.min(...xs) - width / 2;
  const minZ = Math.min(...zs) - depth / 2;
  const spanX = Math.max(...xs) + width / 2 - minX;
  const spanZ = Math.max(...zs) + depth / 2 - minZ;
  return {
    left: ((plot.x - width / 2 - minX) / spanX) * 100,
    top: ((plot.z - depth / 2 - minZ) / spanZ) * 100,
    width: (width / spanX) * 100,
    height: (depth / spanZ) * 100,
  };
}

export function createBuildTab(ctx: UIContext) {
  const { tr, catalog } = ctx;
  const count = h('div', 'wt-section-title');
  const hint = h('p', 'wt-hint');
  const map = h('div', 'wt-plotmap');
  const optionList = h('div', 'wt-list');
  const el = h('div', 'wt-tab', count, map, hint, optionList);
  let layout: IslandLayoutDef | null = null;

  const plots = new KeyedList<PlotItem>(
    map,
    (item) => item.plot.id,
    (first): Row<PlotItem> => {
      const plotId = first.plot.id;
      let buildingId: string | null = null;
      const plotButton = button('wt-plot', () =>
        ctx.select(buildingId ? { type: 'building', buildingId } : { type: 'plot', plotId }),
      );
      const rect = layout ? plotRect(layout, plotId) : null;
      if (rect) {
        plotButton.style.left = `${rect.left}%`;
        plotButton.style.top = `${rect.top}%`;
        plotButton.style.width = `${rect.width}%`;
        plotButton.style.height = `${rect.height}%`;
      }
      return {
        el: plotButton,
        update(item) {
          buildingId = item.plot.buildingId;
          setClass(plotButton, 'is-occupied', buildingId !== null);
          setClass(plotButton, 'is-selected', item.selected);
          const label = item.typeId
            ? tr.t('build.plotOccupied', { building: buildingName(tr, item.typeId), plot: plotId })
            : tr.t('build.plotEmpty', { plot: plotId });
          setAttr(plotButton, 'title', label);
          setAttr(plotButton, 'aria-label', label);
          setAttr(plotButton, 'data-category', item.typeId ? (catalog.buildings[item.typeId]?.category ?? null) : null);
        },
      };
    },
  );

  const options = new KeyedList<OptionItem>(
    optionList,
    (item) => item.option.typeId,
    (first): Row<OptionItem> => {
      const typeId = first.option.typeId;
      let current = first;
      const name = h('span', 'wt-option-name');
      const category = h('span', 'wt-badge');
      const built = h('span', 'wt-option-built');
      const recipe = h('div', 'wt-option-recipe');
      const action = button('wt-btn wt-btn-buy', () => {
        const { option, targetPlot } = current;
        if (!option.unlocked) {
          if (option.unlockId) ctx.run(ctx.commands.unlock(option.unlockId));
        } else if (targetPlot) {
          ctx.run(ctx.commands.build(targetPlot, typeId));
        }
      });
      const row = h(
        'div',
        'wt-option',
        h('div', 'wt-option-info', h('div', 'wt-option-head', name, category), recipe, built),
        action,
      );
      return {
        el: row,
        update(item) {
          current = item;
          const { option, frame } = item;
          const def = catalog.buildings[typeId];
          const recipeDef = def ? catalog.recipes[def.recipe] : undefined;
          setText(name, buildingName(tr, typeId));
          setAttr(row, 'title', tr.tx(keys.buildingDesc(typeId), undefined, ''));
          setText(category, def ? tr.tx(keys.categoryName(def.category)) : '');
          setText(
            recipe,
            recipeDef
              ? `${formatRecipeSide(tr, recipeDef.inputs)} ${tr.t('recipe.arrow')} ${formatRecipeSide(tr, recipeDef.outputs)}`
              : '',
          );
          setText(built, tr.t('build.built', { count: option.builtCount, max: option.maxCount }));
          setHidden(built, option.builtCount === 0);
          setClass(row, 'is-locked', !option.unlocked);
          if (option.unlocked) {
            setText(action, tr.t('build.action', { cost: formatAmount(option.cost) }));
            setDisabled(
              action,
              !option.affordable || item.full || item.targetPlot === null || option.builtCount >= option.maxCount,
            );
          } else {
            const unlock = option.unlockId ? frame.unlocks.get(option.unlockId) : undefined;
            setText(
              action,
              unlock ? tr.t('build.unlockAction', { cost: formatAmount(unlock.cost) }) : tr.t('common.locked'),
            );
            setDisabled(action, !unlock || !unlock.available || !unlock.affordable);
          }
        },
      };
    },
  );

  return {
    el,
    update(frame: Frame): void {
      const island = frame.snapshot.island;
      layout = catalog.islands[island.id]?.layout ?? null;
      if (layout) {
        const { width, depth } = layout.plotSize;
        const xs = layout.plots.map((plot) => plot.x);
        const zs = layout.plots.map((plot) => plot.z);
        const ratio = (Math.max(...xs) - Math.min(...xs) + width) / (Math.max(...zs) - Math.min(...zs) + depth);
        setAttr(map, 'style', `aspect-ratio: ${ratio.toFixed(3)}`);
      }

      const selection = frame.selection;
      const typeOf = new Map(island.buildings.map((building) => [building.id, building.typeId]));
      const full = island.buildings.length >= island.maxBuildings;
      const selectedPlot = selection.type === 'plot' ? island.plots.find((plot) => plot.id === selection.plotId) : undefined;
      const targetPlot = selectedPlot && selectedPlot.buildingId === null ? selectedPlot.id : null;

      setText(count, tr.t('build.count', { count: island.buildings.length, max: island.maxBuildings }));
      setText(
        hint,
        full
          ? tr.t('build.full')
          : targetPlot
            ? tr.t('build.plotSelected', { plot: targetPlot })
            : tr.t('build.pickPlot'),
      );
      setClass(hint, 'is-ready', !full && targetPlot !== null);

      plots.sync(
        island.plots.map((plot) => ({
          plot,
          typeId: plot.buildingId ? (typeOf.get(plot.buildingId) ?? null) : null,
          selected:
            (selection.type === 'plot' && selection.plotId === plot.id) ||
            (selection.type === 'building' && plot.buildingId === selection.buildingId),
        })),
      );
      options.sync(island.buildOptions.map((option) => ({ option, frame, targetPlot, full })));
    },
  };
}
