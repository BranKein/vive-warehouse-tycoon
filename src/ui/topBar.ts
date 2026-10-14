import type { GameSnapshot, GameSpeed, IslandSummaryView } from '@/contracts';
import { getLanguage, keys, LANGUAGES, setLanguage, type Language } from '@/i18n';
import type { UIContext } from './context';
import { createDayClock } from './dayClock';
import { button, h, KeyedList, setAttr, setClass, setFill, setHidden, setText, type Row } from './dom';
import { fillRatio, formatAmount, formatAutoStatus, formatIncome } from './text';

const SPEEDS: readonly GameSpeed[] = [0, 1, 2, 4];

export function createTopBar(
  ctx: UIContext,
  onToggleSaves: () => void,
  onToggleSettings: () => void,
  onToggleAchievements: () => void,
) {
  const { tr } = ctx;
  let autoEnabled = false;

  const moneyLabel = h('span', 'wt-stat-label');
  const moneyValue = h('span', 'wt-stat-value');
  const incomeLabel = h('span', 'wt-stat-label');
  const incomeValue = h('span', 'wt-stat-value wt-income');

  const speedGroup = h('div', 'wt-seg');
  speedGroup.setAttribute('role', 'group');
  const speedButtons = SPEEDS.map((speed) => {
    const el = button('wt-seg-btn', () => ctx.commands.setSpeed(speed));
    speedGroup.append(el);
    return { speed, el };
  });

  const autoLabel = h('span', 'wt-toggle-label');
  const autoState = h('span', 'wt-toggle-state');
  const autoButton = button('wt-toggle', () => ctx.commands.setAutoPilot(!autoEnabled), autoLabel, autoState);
  const autoText = h('span', 'wt-auto-text');
  const autoFill = h('div', 'wt-bar-fill');
  const autoStatus = h('div', 'wt-auto-status', autoText, h('div', 'wt-bar wt-bar-thin', autoFill));

  const islandGroup = h('div', 'wt-seg');
  islandGroup.setAttribute('role', 'group');
  const islands = new KeyedList<IslandSummaryView>(
    islandGroup,
    (island) => island.id,
    (first): Row<IslandSummaryView> => {
      const id = first.id;
      const el = button('wt-seg-btn', () => ctx.run(ctx.commands.switchIsland(id)));
      return {
        el,
        update(island) {
          setText(el, tr.tx(keys.islandName(island.id)));
          setClass(el, 'is-active', island.active);
          setAttr(el, 'aria-pressed', String(island.active));
        },
      };
    },
  );

  const langGroup = h('div', 'wt-seg');
  langGroup.setAttribute('role', 'group');
  const langButtons = LANGUAGES.map((language: Language) => {
    const el = button('wt-seg-btn', () => setLanguage(language));
    langGroup.append(el);
    return { language, el };
  });

  const trophyCount = h('span', 'wt-trophy-count');
  const achievementsButton = button('wt-btn wt-trophy', onToggleAchievements, h('span', 'wt-trophy-icon', '🏆'), trophyCount);
  const savesButton = button('wt-btn wt-saves-toggle', onToggleSaves);
  const settingsButton = button('wt-btn wt-settings-toggle', onToggleSettings);

  // The time of day stands where a plain coin used to, when there is a 3D view to tell it.
  const clock = createDayClock(ctx);

  const el = h(
    'div',
    'wt-topbar wt-card',
    h('div', 'wt-stat wt-stat-money', ctx.dayTime ? clock.el : h('span', 'wt-coin'), h('div', 'wt-stat-text', moneyLabel, moneyValue)),
    h('div', 'wt-stat', h('div', 'wt-stat-text', incomeLabel, incomeValue)),
    speedGroup,
    h('div', 'wt-auto', autoButton, autoStatus),
    islandGroup,
    langGroup,
    achievementsButton,
    savesButton,
    settingsButton,
  );

  return {
    el,
    dispose: clock.dispose,
    savesButton,
    settingsButton,
    update(snapshot: GameSnapshot, savesOpen: boolean, settingsOpen: boolean, achievementsOpen: boolean): void {
      clock.rerender();
      clock.update();
      setText(moneyLabel, tr.t('top.money'));
      setText(moneyValue, formatAmount(snapshot.money));
      setText(incomeLabel, tr.t('top.incomeLabel'));
      setText(incomeValue, formatIncome(tr, snapshot.incomePerSec));

      setAttr(speedGroup, 'aria-label', tr.t('speed.label'));
      for (const { speed, el: speedButton } of speedButtons) {
        setText(speedButton, speed === 0 ? tr.t('speed.pause') : tr.t('speed.times', { n: speed }));
        setClass(speedButton, 'is-active', snapshot.speed === speed);
        setAttr(speedButton, 'aria-pressed', String(snapshot.speed === speed));
      }

      const auto = snapshot.autoPilot;
      autoEnabled = auto.enabled;
      setText(autoLabel, tr.t('auto.label'));
      setText(autoState, auto.enabled ? tr.t('auto.on') : tr.t('auto.off'));
      setClass(autoButton, 'is-on', auto.enabled);
      setAttr(autoButton, 'aria-pressed', String(auto.enabled));
      setAttr(autoButton, 'title', tr.t('auto.hint'));
      setHidden(autoStatus, !auto.enabled);
      const status = formatAutoStatus(tr, auto);
      setText(autoText, status);
      setAttr(autoStatus, 'title', status);
      setFill(autoFill, auto.targetCost ? fillRatio(snapshot.money, auto.targetCost) : 0);

      // The island switcher only appears once there is more than one island.
      setHidden(islandGroup, snapshot.islands.length < 2);
      setAttr(islandGroup, 'aria-label', tr.t('island.label'));
      islands.sync(snapshot.islands);

      setAttr(langGroup, 'aria-label', tr.t('lang.label'));
      const language = getLanguage();
      for (const { language: lang, el: langButton } of langButtons) {
        setText(langButton, tr.t(`lang.${lang}`));
        setClass(langButton, 'is-active', lang === language);
        setAttr(langButton, 'aria-pressed', String(lang === language));
      }

      const achievements = snapshot.achievements;
      setText(trophyCount, `${achievements.achieved}/${achievements.list.length}`);
      setAttr(achievementsButton, 'title', tr.t('top.achievements'));
      setAttr(achievementsButton, 'aria-label', `${tr.t('top.achievements')} ${achievements.achieved}/${achievements.list.length}`);
      setClass(achievementsButton, 'is-active', achievementsOpen);

      setText(savesButton, tr.t('save.menu'));
      setClass(savesButton, 'is-active', savesOpen);
      setAttr(savesButton, 'aria-expanded', String(savesOpen));

      setText(settingsButton, tr.t('settings.menu'));
      setClass(settingsButton, 'is-active', settingsOpen);
      setAttr(settingsButton, 'aria-expanded', String(settingsOpen));
    },
  };
}
