import type { UIContext } from './context';
import { button, h, setAttr, setHidden, setText } from './dom';

/** Which picture the button shows for each part of the day. */
const ICONS: Record<string, 'rise' | 'sun' | 'set' | 'moon'> = {
  dawn: 'rise',
  morning: 'sun',
  day: 'sun',
  afternoon: 'sun',
  sunset: 'set',
  dusk: 'set',
  night: 'moon',
  lateNight: 'moon',
};

const TURN = Math.PI * 2;

/**
 * The time of day the picture shows: a button whose icon follows it, and a
 * dial under it on which the player sets it. Only the look of the game
 * changes; the game's own clock is not touched.
 */
export function createDayClock(ctx: UIContext) {
  const { tr } = ctx;
  const time = ctx.dayTime;
  let open = false;
  let part = '';
  let dragging = false;

  const toggle = button('wt-daytime', () => setOpen(!open));
  const title = h('div', 'wt-section-title');
  const hand = h('div', 'wt-dial-hand', h('span', 'wt-dial-knob'));
  const dial = h('div', 'wt-dial', hand);
  const name = h('div', 'wt-dial-name');
  const lockState = h('span', 'wt-toggle-state');
  const lockLabel = h('span', 'wt-toggle-label');
  const lock = button('wt-toggle wt-daytime-lock', () => {
    time?.setLocked(!time.locked());
    texts();
  }, lockLabel, lockState);
  const popover = h('div', 'wt-card wt-daytime-pop', title, dial, name, lock);
  popover.setAttribute('role', 'dialog');
  const el = h('div', 'wt-daytime-wrap', toggle, popover);

  if (time) {
    // The ring is painted with the sky of each part of the day, starting at the top and going clockwise.
    const stops = time.parts.map((entry) => `${entry.color} ${(entry.at * 360).toFixed(1)}deg`);
    stops.push(`${time.parts[0]!.color} 360deg`);
    dial.style.background = `conic-gradient(${stops.join(', ')})`;
  }

  const partAt = (phase: number): string => {
    if (!time) return '';
    let found = time.parts[time.parts.length - 1]!.name;
    for (const entry of time.parts) if (entry.at <= phase) found = entry.name;
    return found;
  };

  const pointTo = (event: PointerEvent): void => {
    const box = dial.getBoundingClientRect();
    const angle = Math.atan2(event.clientX - (box.left + box.width / 2), box.top + box.height / 2 - event.clientY);
    time?.setPhase(((angle + TURN) % TURN) / TURN);
    update();
  };
  dial.addEventListener('pointerdown', (event) => {
    dragging = true;
    dial.setPointerCapture(event.pointerId);
    pointTo(event);
  });
  dial.addEventListener('pointermove', (event) => {
    if (dragging) pointTo(event);
  });
  const release = (): void => {
    dragging = false;
  };
  dial.addEventListener('pointerup', release);
  dial.addEventListener('pointercancel', release);

  function texts(): void {
    setText(title, tr.t('daytime.title'));
    setText(name, part ? tr.tx(`daytime.${part}`) : '');
    const label = part ? `${tr.t('daytime.title')}: ${tr.tx(`daytime.${part}`)}` : tr.t('daytime.title');
    setAttr(toggle, 'title', label);
    setAttr(toggle, 'aria-label', label);
    setAttr(toggle, 'aria-expanded', String(open));
    setAttr(popover, 'aria-label', tr.t('daytime.title'));
    const locked = time?.locked() ?? false;
    setText(lockLabel, tr.t('daytime.lock'));
    setText(lockState, locked ? tr.t('auto.on') : tr.t('auto.off'));
    lock.classList.toggle('is-on', locked);
    setAttr(lock, 'aria-pressed', String(locked));
    setAttr(lock, 'title', tr.t('daytime.lockHint'));
  }

  /** Follows the time of day; cheap enough to call every frame. */
  function update(): void {
    if (!time) return;
    const phase = time.phase();
    const now = partAt(phase);
    if (now !== part) {
      part = now;
      setAttr(toggle, 'data-icon', ICONS[part] ?? 'sun');
      texts();
    }
    if (open) hand.style.transform = `rotate(${(phase * 360).toFixed(1)}deg)`;
  }

  function setOpen(next: boolean): void {
    open = next;
    setHidden(popover, !open);
    texts();
    update();
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (open && event.target instanceof Node && !el.contains(event.target)) setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (open && event.key === 'Escape') setOpen(false);
  };
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeyDown);
  setAttr(toggle, 'data-icon', 'sun');
  setOpen(false);

  return {
    el,
    update,
    rerender: texts,
    dispose(): void {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    },
  };
}
