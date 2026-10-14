import type { AchievementDef, AchievementView } from '@/contracts';
import { formatDuration, formatNumber } from '@/core/format';
import type { Frame, UIContext } from './context';
import { button, h, KeyedList, setAttr, setClass, setFill, setHidden, setText, type Row } from './dom';
import { fillRatio, formatAmount, formatPercent, type Translator } from './text';

export const achievementName = (tr: Translator, id: string): string => tr.tx(`achievement.${id}.name`);

/** A measure in the units it is counted in. */
function formatMeasure(def: AchievementDef, value: AchievementView['value']): string {
  const kind = def.metric.kind;
  if (kind === 'playSeconds') return formatDuration(Math.floor(value.toNumber()));
  if (kind === 'earned' || kind === 'income') return formatAmount(value);
  return formatNumber(value.floor());
}

interface Entry {
  def: AchievementDef;
  view: AchievementView;
}

/** The window listing every achievement by group: reached ones in colour with when, the rest with how far along. */
export function createAchievementsModal(ctx: UIContext, onChange: () => void) {
  const { tr, catalog } = ctx;
  let open = false;
  const close = (): void => {
    open = false;
    onChange();
  };

  const title = h('div', 'wt-menu-title');
  const summary = h('div', 'wt-hover-note');
  const closeButton = button('wt-icon-btn', close);
  setText(closeButton, '×');

  const row = (): Row<Entry> => {
    const medal = h('span', 'wt-medal');
    const name = h('span', 'wt-ach-name');
    const desc = h('div', 'wt-ach-desc');
    const state = h('span', 'wt-stats-value');
    const fill = h('div', 'wt-bar-fill');
    const bar = h('div', 'wt-bar wt-bar-thin', fill);
    const el = h('div', 'wt-ach', medal, h('div', 'wt-ach-body', h('div', 'wt-stock-head', name, state), desc, bar));
    return {
      el,
      update({ def, view }) {
        const done = view.achievedAtSec !== null;
        setClass(el, 'is-done', done);
        medal.className = `wt-medal wt-medal-${def.tier}`;
        setAttr(medal, 'title', tr.tx(`achievements.tier.${def.tier}`));
        setText(name, achievementName(tr, def.id));
        setText(desc, tr.tx(`achievement.${def.id}.desc`));
        setText(
          state,
          done
            ? tr.t('achievements.reachedAt', { time: formatDuration(Math.floor(view.achievedAtSec ?? 0)) })
            : tr.t('achievements.progress', { value: formatMeasure(def, view.value), goal: formatMeasure(def, view.goal) }),
        );
        setHidden(bar, done);
        setFill(fill, fillRatio(view.value, view.goal));
      },
    };
  };

  // One section per group, in the order the groups first appear.
  const groups = [...new Set(catalog.achievements.map((def) => def.group))].map((group) => {
    const heading = h('div', 'wt-section-title');
    const box = h('div', 'wt-stocks');
    const list = new KeyedList<Entry>(box, (entry) => entry.def.id, row);
    return { group, heading, list, el: h('section', 'wt-stats-section', heading, box) };
  });

  const card = h(
    'div',
    'wt-build-modal wt-stats-modal wt-card',
    h('div', 'wt-menu-head', h('div', 'wt-build-title', title, summary), closeButton),
    h('div', 'wt-stats-scroll', h('div', 'wt-stats-grid', ...groups.map((group) => group.el))),
  );
  card.setAttribute('role', 'dialog');
  const el = h('div', 'wt-backdrop', card);
  el.addEventListener('pointerdown', (event) => {
    if (event.target === el) close();
  });
  el.hidden = true;

  return {
    el,
    isOpen: (): boolean => open,
    toggle(): void {
      open = !open;
      onChange();
    },
    close,
    update(frame: Frame): void {
      setHidden(el, !open);
      if (!open) return;
      const achievements = frame.snapshot.achievements;
      const views = new Map(achievements.list.map((view) => [view.id, view]));
      setText(title, tr.t('achievements.title'));
      setText(
        summary,
        tr.t('achievements.summary', {
          done: achievements.achieved,
          total: achievements.list.length,
          bonus: formatPercent(achievements.saleBonus),
        }),
      );
      setAttr(closeButton, 'aria-label', tr.t('common.close'));
      setAttr(closeButton, 'title', tr.t('common.close'));
      for (const group of groups) {
        setText(group.heading, tr.tx(`achievements.group.${group.group}`));
        group.list.sync(
          catalog.achievements.flatMap((def) => {
            const view = views.get(def.id);
            return def.group === group.group && view ? [{ def, view }] : [];
          }),
        );
      }
    },
  };
}
