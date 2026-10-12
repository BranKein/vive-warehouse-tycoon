import type { TabId, Frame, UIContext } from './context';
import { button, h, setAttr, setClass, setHidden, setText } from './dom';
import { createBuildTab } from './buildTab';
import { createBuildingTab } from './buildingTab';
import { createLogisticsTab } from './logisticsTab';
import { createUnlocksTab } from './unlocksTab';

const TAB_ORDER: readonly TabId[] = ['build', 'building', 'unlocks', 'upgrades'];

/** The floating panel on the right edge: four tabs and a button that folds it away. */
export function createSidePanel(ctx: UIContext, onChange: () => void) {
  const { tr } = ctx;
  let active: TabId = 'build';
  let collapsed = false;

  const logistics = createLogisticsTab(ctx);
  const tabs: Record<TabId, { el: HTMLElement; update(frame: Frame): void }> = {
    build: createBuildTab(ctx),
    building: createBuildingTab(ctx),
    unlocks: createUnlocksTab(ctx),
    upgrades: logistics,
  };

  const tabBar = h('div', 'wt-tabs');
  tabBar.setAttribute('role', 'tablist');
  const tabButtons = TAB_ORDER.map((id) => {
    const el = button('wt-tab-btn', () => {
      active = id;
      collapsed = false;
      onChange();
    });
    el.setAttribute('role', 'tab');
    tabBar.append(el);
    return { id, el };
  });
  const collapse = button('wt-icon-btn wt-collapse', () => {
    collapsed = !collapsed;
    onChange();
  });
  const body = h('div', 'wt-panel-body', ...TAB_ORDER.map((id) => tabs[id].el));
  const el = h('aside', 'wt-panel wt-card', h('div', 'wt-panel-head', tabBar, collapse), body);

  return {
    el,
    show(tab: TabId): void {
      active = tab;
      collapsed = false;
    },
    reveal(facilityId: string): void {
      logistics.reveal(facilityId);
    },
    update(frame: Frame): void {
      for (const { id, el: tabButton } of tabButtons) {
        setText(tabButton, tr.t(`tab.${id}`));
        setClass(tabButton, 'is-active', id === active && !collapsed);
        setAttr(tabButton, 'aria-selected', String(id === active && !collapsed));
        setHidden(tabs[id].el, id !== active);
      }
      const collapseLabel = collapsed ? tr.t('panel.expand') : tr.t('panel.collapse');
      setText(collapse, collapsed ? '‹' : '›');
      setAttr(collapse, 'title', collapseLabel);
      setAttr(collapse, 'aria-label', collapseLabel);
      setAttr(collapse, 'aria-expanded', String(!collapsed));
      setClass(el, 'is-collapsed', collapsed);
      setHidden(body, collapsed);
      // Hidden tabs are not updated; they catch up as soon as they are shown.
      if (!collapsed) tabs[active].update(frame);
    },
  };
}
