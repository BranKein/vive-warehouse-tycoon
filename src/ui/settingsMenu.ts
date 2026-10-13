import type { GameSnapshot, GameSpeed } from '@/contracts';
import { getLanguage, LANGUAGES, setLanguage, type Language } from '@/i18n';
import type { UIContext } from './context';
import { button, h, setAttr, setClass, setDisabled, setHidden, setText } from './dom';
import { LINKS } from './links';

const SPEEDS: readonly GameSpeed[] = [0, 1, 2, 4];

const openLink = (url: string): void => {
  if (url) window.open(url, '_blank', 'noopener');
};

/** Popover with language, sound, game speed and outside links. */
export function createSettingsMenu(ctx: UIContext, onToggle: () => void) {
  const { tr } = ctx;
  let open = false;
  let speed: GameSpeed = 1;

  const title = h('h3', 'wt-menu-title');
  const close = button('wt-icon-btn', () => setOpen(false), '×');

  const langTitle = h('div', 'wt-section-title');
  const langGroup = h('div', 'wt-seg');
  langGroup.setAttribute('role', 'group');
  const langButtons = LANGUAGES.map((language: Language) => {
    const el = button('wt-seg-btn', () => setLanguage(language));
    langGroup.append(el);
    return { language, el };
  });

  const soundTitle = h('div', 'wt-section-title');
  const soundButton = button('wt-btn', () => {});
  setDisabled(soundButton, true);
  const soundHint = h('p', 'wt-hint');

  const speedTitle = h('div', 'wt-section-title');
  const speedGroup = h('div', 'wt-seg');
  speedGroup.setAttribute('role', 'group');
  const speedButtons = SPEEDS.map((value) => {
    const el = button('wt-seg-btn', () => ctx.commands.setSpeed(value));
    speedGroup.append(el);
    return { speed: value, el };
  });

  // Looks: a small picture of the game in each, so the choice can be seen before it is made.
  const lookTitle = h('div', 'wt-section-title');
  const lookGroup = h('div', 'wt-looks');
  lookGroup.setAttribute('role', 'group');
  const lookButtons = (ctx.looks?.names ?? []).map((name) => {
    const picture = h('img', 'wt-look-img') as HTMLImageElement;
    picture.src = `${import.meta.env.BASE_URL}looks/${name}.jpg`;
    picture.alt = '';
    picture.loading = 'lazy';
    const label = h('span', 'wt-look-name');
    const el = button('wt-look', () => {
      ctx.looks?.set(name);
      render();
    });
    el.append(picture, label);
    lookGroup.append(el);
    return { name, el, label };
  });

  const github = button('wt-btn', () => openLink(LINKS.github));
  const kofi = button('wt-btn', () => openLink(LINKS.kofi));
  setDisabled(kofi, !LINKS.kofi);

  const el = h(
    'div',
    'wt-menu wt-card wt-settings',
    h('div', 'wt-menu-head', title, close),
    langTitle,
    langGroup,
    soundTitle,
    h('div', 'wt-settings-row', soundButton, soundHint),
    speedTitle,
    speedGroup,
    ...(lookButtons.length > 0 ? [lookTitle, lookGroup] : []),
    h('div', 'wt-menu-foot wt-settings-links', github, kofi),
  );
  el.setAttribute('role', 'dialog');

  function render(): void {
    setHidden(el, !open);
    setText(title, tr.t('settings.menu'));
    setAttr(el, 'aria-label', tr.t('settings.menu'));
    setAttr(close, 'aria-label', tr.t('common.close'));
    setAttr(close, 'title', tr.t('common.close'));

    setText(langTitle, tr.t('lang.label'));
    const language = getLanguage();
    for (const { language: lang, el: langButton } of langButtons) {
      setText(langButton, tr.t(`lang.${lang}`));
      setClass(langButton, 'is-active', lang === language);
      setAttr(langButton, 'aria-pressed', String(lang === language));
    }

    setText(soundTitle, tr.t('settings.sound'));
    setText(soundButton, tr.t('settings.soundOff'));
    setText(soundHint, tr.t('settings.soundSoon'));

    setText(speedTitle, tr.t('speed.label'));
    for (const { speed: value, el: speedButton } of speedButtons) {
      setText(speedButton, value === 0 ? tr.t('speed.pause') : tr.t('speed.times', { n: value }));
      setClass(speedButton, 'is-active', value === speed);
      setAttr(speedButton, 'aria-pressed', String(value === speed));
    }

    setText(lookTitle, tr.t('settings.look'));
    const look = ctx.looks?.current();
    for (const { name, el: lookButton, label } of lookButtons) {
      setText(label, tr.tx(`look.${name}`));
      setClass(lookButton, 'is-active', name === look);
      setAttr(lookButton, 'aria-pressed', String(name === look));
    }

    setText(github, tr.t('settings.github'));
    setText(kofi, tr.t('settings.kofi'));
    setAttr(kofi, 'title', LINKS.kofi ? null : tr.t('settings.kofiSoon'));
  }

  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    render();
    onToggle();
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (open && event.key === 'Escape') setOpen(false);
  };
  document.addEventListener('keydown', onKeyDown);
  render();

  return {
    el,
    isOpen: (): boolean => open,
    toggle: (): void => setOpen(!open),
    close: (): void => setOpen(false),
    /** The current speed only comes from the snapshot. */
    update(snapshot: GameSnapshot): void {
      if (snapshot.speed === speed) return;
      speed = snapshot.speed;
      if (open) render();
    },
    rerender: render,
    dispose(): void {
      document.removeEventListener('keydown', onKeyDown);
      el.remove();
    },
  };
}
