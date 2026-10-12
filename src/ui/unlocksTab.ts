import type { UnlockView } from '@/contracts';
import type { Frame, UIContext } from './context';
import { button, h, KeyedList, setClass, setDisabled, setHidden, setText, type Row } from './dom';
import { formatAmount, formatList, formatUnlockGrant, missingRequirements, unlockName } from './text';

interface UnlockItem {
  unlock: UnlockView;
  frame: Frame;
}

export function createUnlocksTab(ctx: UIContext) {
  const { tr, catalog } = ctx;
  const listBox = h('div', 'wt-list');
  const el = h('div', 'wt-tab', listBox);

  const list = new KeyedList<UnlockItem>(
    listBox,
    (item) => item.unlock.id,
    (first): Row<UnlockItem> => {
      const unlockId = first.unlock.id;
      const name = h('span', 'wt-option-name');
      const grant = h('div', 'wt-option-recipe');
      const requires = h('div', 'wt-requires');
      const done = h('span', 'wt-badge wt-badge-good');
      const buy = button('wt-btn wt-btn-buy', () => ctx.run(ctx.commands.unlock(unlockId)));
      const row = h('div', 'wt-option', h('div', 'wt-option-info', h('div', 'wt-option-head', name), grant, requires), done, buy);
      return {
        el: row,
        update({ unlock, frame }) {
          const def = catalog.unlocks[unlockId];
          setText(name, unlockName(tr, unlockId));
          setText(grant, def ? formatUnlockGrant(tr, def) : '');
          const missing = unlock.unlocked
            ? []
            : missingRequirements(catalog, unlockId, (id) => frame.unlocks.get(id)?.unlocked ?? false);
          setHidden(requires, missing.length === 0);
          setText(
            requires,
            missing.length === 0
              ? ''
              : tr.t('unlocks.requires', { names: formatList(tr, missing.map((id) => unlockName(tr, id))) }),
          );
          setClass(row, 'is-done', unlock.unlocked);
          setClass(row, 'is-locked', !unlock.unlocked && !unlock.available);
          setHidden(done, !unlock.unlocked);
          setHidden(buy, unlock.unlocked);
          setText(done, tr.t('unlocks.done'));
          setText(buy, tr.t('unlocks.buy', { cost: formatAmount(unlock.cost) }));
          setDisabled(buy, !unlock.available || !unlock.affordable);
        },
      };
    },
  );

  return {
    el,
    update(frame: Frame): void {
      list.sync(frame.snapshot.unlocks.map((unlock) => ({ unlock, frame })));
    },
  };
}
