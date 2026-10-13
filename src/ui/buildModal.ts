import type { BuildOptionView } from '@/contracts';
import { keys } from '@/i18n';
import type { Frame, UIContext } from './context';
import { button, h, KeyedList, setAttr, setClass, setDisabled, setHidden, setText, type Row } from './dom';
import { buildingName, formatAmount, formatRecipeSide } from './text';

interface OptionItem {
  option: BuildOptionView;
  frame: Frame;
  plotId: string;
  full: boolean;
}

const ALL = 'all';
const CATEGORY_ORDER = ['tier1', 'tier2', 'tier3', 'tier4', 'handmade', 'disposal'];

/** The window that opens over an empty plot that was clicked: pick what to build there. */
export function createBuildModal(ctx: UIContext, onChange: () => void) {
  const { tr, catalog } = ctx;
  let open = false;
  /** A building category, or `ALL`. */
  let tab = ALL;
  const dismiss = (): void => ctx.select({ type: 'none' });

  const title = h('div', 'wt-menu-title');
  const count = h('span', 'wt-badge');
  const close = button('wt-icon-btn', dismiss);
  setText(close, '×');
  const hint = h('p', 'wt-hint');
  const optionList = h('div', 'wt-list wt-build-grid');

  // One tab per building category that the catalog has: production stages first, then the rest.
  const used = new Set<string>(Object.values(catalog.buildings).map((building) => building.category));
  const tabIds = [ALL, ...CATEGORY_ORDER.filter((id) => used.delete(id)), ...used];
  const tabBar = h('div', 'wt-tabs wt-build-tabs');
  tabBar.setAttribute('role', 'tablist');
  const tabButtons = tabIds.map((id) => {
    const tabButton = button('wt-tab-btn', () => {
      tab = id;
      optionList.scrollTop = 0;
      onChange();
    });
    tabButton.setAttribute('role', 'tab');
    tabBar.append(tabButton);
    return { id, el: tabButton };
  });

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
        const { option, plotId } = current;
        if (option.unlocked) ctx.run(ctx.commands.build(plotId, typeId));
        else if (option.unlockId) ctx.run(ctx.commands.unlock(option.unlockId));
      });
      const row = h(
        'div',
        'wt-option',
        h('div', 'wt-option-info', h('div', 'wt-option-head', name, category), recipe),
        h('div', 'wt-option-foot', built, action),
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
          setClass(row, 'is-locked', !option.unlocked);
          if (option.unlocked) {
            setText(action, tr.t('build.action', { cost: formatAmount(option.cost) }));
            setDisabled(action, !option.affordable || item.full || option.builtCount >= option.maxCount);
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

  const card = h(
    'div',
    'wt-build-modal wt-card',
    h('div', 'wt-menu-head', h('div', 'wt-build-title', title, count), close),
    tabBar,
    hint,
    optionList,
  );
  card.setAttribute('role', 'dialog');
  const el = h('div', 'wt-backdrop', card);
  // A press on the dimmed area around the window closes it.
  el.addEventListener('pointerdown', (event) => {
    if (event.target === el) dismiss();
  });
  el.hidden = true;

  return {
    el,
    isOpen: (): boolean => open,
    dismiss,
    update(frame: Frame): void {
      const island = frame.snapshot.island;
      const selection = frame.selection;
      const plot = selection.type === 'plot' ? island.plots.find((entry) => entry.id === selection.plotId) : undefined;
      open = plot !== undefined && plot.buildingId === null;
      setHidden(el, !open);
      if (!open || !plot) return;

      const full = island.buildings.length >= island.maxBuildings;
      setText(title, tr.t('build.title'));
      setText(count, tr.t('build.count', { count: island.buildings.length, max: island.maxBuildings }));
      setAttr(close, 'aria-label', tr.t('common.close'));
      setAttr(close, 'title', tr.t('common.close'));
      setHidden(hint, !full);
      setText(hint, full ? tr.t('build.full') : '');
      for (const { id, el: tabButton } of tabButtons) {
        setText(tabButton, id === ALL ? tr.t('build.all') : tr.tx(keys.categoryName(id)));
        setClass(tabButton, 'is-active', id === tab);
        setAttr(tabButton, 'aria-selected', String(id === tab));
      }
      const shown = island.buildOptions.filter(
        (option) => tab === ALL || catalog.buildings[option.typeId]?.category === tab,
      );
      options.sync(shown.map((option) => ({ option, frame, plotId: plot.id, full })));
    },
  };
}
