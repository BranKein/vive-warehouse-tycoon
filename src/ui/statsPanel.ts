import type { BuildingStatus, BuildingView } from '@/contracts';
import { formatDuration } from '@/core/format';
import type { Frame, UIContext } from './context';
import { button, h, KeyedList, setAttr, setClass, setFill, setHidden, setText, type Row } from './dom';
import { buildingName, formatBuildingStatus, formatPercent, wasteLevel } from './text';

const STATUSES: readonly BuildingStatus[] = ['working', 'starved', 'outputFull', 'idle'];

interface StatusItem {
  status: BuildingStatus;
  count: number;
}

/**
 * The card on the right edge: how many buildings stand, what they are doing
 * right now and how much of the last minutes each of them worked, least
 * first. A button opens the window with the rest of the figures.
 */
export function createStatsPanel(ctx: UIContext, openDetails: () => void, onChange: () => void) {
  const { tr } = ctx;
  let collapsed = false;

  const title = h('div', 'wt-stats-title');
  const collapse = button('wt-icon-btn wt-collapse', () => {
    collapsed = !collapsed;
    onChange();
  });
  const count = h('div', 'wt-stats-count');

  const statusBox = h('div', 'wt-stats-statuses');
  const statuses = new KeyedList<StatusItem>(
    statusBox,
    (item) => item.status,
    (): Row<StatusItem> => {
      const dot = h('span', 'wt-dot');
      const label = h('span');
      const el = h('span', 'wt-stats-status', dot, label);
      return {
        el,
        update(item) {
          setAttr(dot, 'data-status', item.status);
          setText(label, `${tr.t(`stats.${item.status}`)} ${item.count}`);
          setClass(el, 'is-zero', item.count === 0);
        },
      };
    },
  );

  const averageLabel = h('span');
  const averageValue = h('span', 'wt-stats-value');
  const averageFill = h('div', 'wt-bar-fill');
  const average = h('div', 'wt-stats-average', h('div', 'wt-stock-head', averageLabel, averageValue), h('div', 'wt-bar', averageFill));
  const windowNote = h('div', 'wt-hover-note');

  const listBox = h('div', 'wt-stats-list');
  const list = new KeyedList<BuildingView>(
    listBox,
    (building) => building.id,
    (first): Row<BuildingView> => {
      const buildingId = first.id;
      const dot = h('span', 'wt-dot');
      const name = h('span', 'wt-stats-name');
      const value = h('span', 'wt-stats-value');
      const fill = h('div', 'wt-bar-fill');
      const el = button(
        'wt-stats-row',
        () => ctx.select({ type: 'building', buildingId }),
        h('span', 'wt-stock-head', h('span', 'wt-stats-who', dot, name), value),
        h('div', 'wt-bar wt-bar-thin', fill),
      );
      return {
        el,
        update(building) {
          setText(name, buildingName(tr, building.typeId));
          setAttr(dot, 'data-status', wasteLevel(building.wasteRatio) === 'clogged' ? 'clogged' : building.status);
          setAttr(el, 'title', formatBuildingStatus(tr, building));
          setText(value, building.uptime === null ? '–' : `${formatPercent(building.uptime)}%`);
          setFill(fill, building.uptime ?? 0);
        },
      };
    },
  );
  const details = button('wt-btn', openDetails);

  const body = h('div', 'wt-stats-body', count, statusBox, average, windowNote, listBox, details);
  const el = h('aside', 'wt-stats wt-card', h('div', 'wt-stats-head', title, collapse), body);

  return {
    el,
    update(frame: Frame): void {
      const island = frame.snapshot.island;
      setText(title, tr.t('stats.title'));
      const collapseLabel = collapsed ? tr.t('panel.expand') : tr.t('panel.collapse');
      setText(collapse, collapsed ? '▾' : '▴');
      setAttr(collapse, 'title', collapseLabel);
      setAttr(collapse, 'aria-label', collapseLabel);
      setHidden(body, collapsed);
      if (collapsed) return;

      setText(count, tr.t('build.count', { count: island.buildings.length, max: island.maxBuildings }));
      statuses.sync(
        STATUSES.map((status) => ({ status, count: island.buildings.filter((building) => building.status === status).length })),
      );

      const { averageUptime, windowSec } = island.stats;
      setText(averageLabel, tr.t('stats.averageUptime'));
      setText(averageValue, averageUptime === null ? '–' : `${formatPercent(averageUptime)}%`);
      setFill(averageFill, averageUptime ?? 0);
      setText(windowNote, windowSec > 0 ? tr.t('stats.window', { time: formatDuration(windowSec) }) : tr.t('stats.noData'));

      // The buildings that work least come first: those are the ones worth a look.
      const byUptime = [...island.buildings].sort((a, b) => (a.uptime ?? 2) - (b.uptime ?? 2));
      list.sync(byUptime);
      setHidden(listBox, byUptime.length === 0);
      setText(details, tr.t('stats.details'));
    },
  };
}
