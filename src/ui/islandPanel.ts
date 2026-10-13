import type { UIContext } from './context';
import { button, h, setAttr, setText } from './dom';

/**
 * The card on the right edge for travelling to other islands. Islands are
 * not playable yet, so for now it is only its locked state: a padlock that
 * says so when pressed. Once islands open, the list of them goes in this card.
 */
export function createIslandPanel(ctx: UIContext) {
  const { tr } = ctx;
  const label = h('span', 'wt-islands-label');
  const lock = button(
    'wt-islands-lock',
    () => ctx.notify('info', () => tr.t('islands.notReady')),
    h('span', 'wt-padlock', h('span', 'wt-padlock-shackle'), h('span', 'wt-padlock-body')),
    label,
  );
  const el = h('aside', 'wt-islands wt-card is-locked', lock);

  return {
    el,
    update(): void {
      setText(label, tr.t('islands.title'));
      setAttr(lock, 'title', tr.t('islands.locked'));
      setAttr(lock, 'aria-label', tr.t('islands.locked'));
    },
  };
}
