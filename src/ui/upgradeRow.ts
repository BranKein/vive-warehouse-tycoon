import type { UpgradeTrackId, UpgradeView } from '@/contracts';
import { keys } from '@/i18n';
import type { UIContext } from './context';
import { button, h, setAttr, setClass, setDisabled, setText, type Row } from './dom';
import { formatAmount, formatUpgradeEffect, formatUpgradeLevel, isMaxed, upgradeName } from './text';

/** One upgrade track: name, level, effect now → next, and a button showing the cost. */
export function createUpgradeRow(ctx: UIContext, onBuy: (trackId: UpgradeTrackId) => void): Row<UpgradeView> {
  const { tr } = ctx;
  let trackId: UpgradeTrackId = '';
  const name = h('span', 'wt-upgrade-name');
  const level = h('span', 'wt-badge');
  const desc = h('div', 'wt-upgrade-desc');
  const effect = h('div', 'wt-upgrade-effect');
  const buy = button('wt-btn wt-btn-buy', () => onBuy(trackId));
  const el = h('div', 'wt-upgrade', h('div', 'wt-upgrade-info', h('div', 'wt-upgrade-head', name, level), desc, effect), buy);

  return {
    el,
    update(view) {
      trackId = view.trackId;
      const maxed = isMaxed(view);
      setText(name, upgradeName(tr, view.trackId));
      setText(level, formatUpgradeLevel(tr, view));
      setText(desc, tr.tx(keys.upgradeDesc(view.trackId), undefined, ''));
      setText(effect, formatUpgradeEffect(tr, view));
      const label = view.cost === null ? tr.t('common.max') : tr.t('upgrade.buy', { cost: formatAmount(view.cost) });
      setText(buy, label);
      setDisabled(buy, maxed || !view.affordable);
      setClass(el, 'is-maxed', maxed);
      setAttr(buy, 'aria-label', `${upgradeName(tr, view.trackId)} ${label}`);
    },
  };
}
