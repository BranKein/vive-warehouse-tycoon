import type { GameSnapshot, GameSpeed } from '@/contracts';
import { getLanguage, LANGUAGES, setLanguage, type Language } from '@/i18n';
import type { UIContext } from './context';
import { button, h, setAttr, setClass, setDisabled, setHidden, setText } from './dom';
import { KOFI_ICON, LINKS } from './links';

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

  // The GitHub mark (Octicons, MIT), drawn in the text colour.
  const githubIcon = h('span', 'wt-link-icon');
  githubIcon.innerHTML =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
  const githubLabel = h('span');
  const github = button('wt-btn wt-github', () => openLink(LINKS.github), githubIcon, githubLabel);
  const kofiIcon = h('img', 'wt-kofi-icon');
  kofiIcon.src = KOFI_ICON;
  kofiIcon.alt = '';
  const kofiLabel = h('span');
  const kofi = button('wt-btn wt-kofi', () => openLink(LINKS.kofi), kofiIcon, kofiLabel);
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

    setText(githubLabel, tr.t('settings.github'));
    setText(kofiLabel, tr.t('settings.kofi').replace(/^☕\s*/, ''));
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
