/**
 * The right-hand ad rail. index.html only has it when the build was given AdSense settings
 * (see `adSense` in vite.config.ts). It is shown on wide screens with a mouse; the game area
 * (canvas and UI overlay) then ends where the rail begins, so no game control sits next to the ad.
 */

/** The rail is shown from this viewport width up. */
export const AD_RAIL_MIN_VIEWPORT = 1200;
/** Reserved width: 24px gap on the game side + the 160px unit + 16px on the outer side. */
export const AD_RAIL_WIDTH = 200;

/** Whether the rail is shown for a viewport this wide, with or without a fine pointer (mouse). */
export const showAdRail = (viewportWidth: number, finePointer: boolean): boolean =>
  finePointer && viewportWidth >= AD_RAIL_MIN_VIEWPORT;

/** Width left for the game: the whole viewport, or what is left beside a shown rail. */
export const gameAreaWidth = (viewportWidth: number, railShown: boolean): number =>
  Math.max(1, railShown ? viewportWidth - AD_RAIL_WIDTH : viewportWidth);

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Connects the rail if the page has one. The returned function lays it out for the current window
 * and says whether it is shown; call it before sizing the game. AdSense is asked for an ad the first
 * time the rail is shown (a hidden unit has no size and would fail).
 */
export function setupAdRail(): () => boolean {
  const rail = document.getElementById('ad-rail');
  if (!rail) return () => false;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  let requested = false;
  return () => {
    const shown = showAdRail(window.innerWidth, fine.matches);
    const root = document.documentElement;
    root.classList.toggle('ad-rail-on', shown);
    root.style.setProperty('--ad-rail-width', shown ? `${AD_RAIL_WIDTH}px` : '0px');
    if (shown && !requested) {
      requested = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        // Blocked or not ready: the rail stays empty with its label; the game is unaffected.
        console.warn(error);
      }
    }
    return shown;
  };
}
