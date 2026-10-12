/** App-level timing. Game balance lives in `src/content`; these only describe how the app drives the simulation. */
export const APP_CONFIG = {
  /** While the tab is hidden the game keeps running at this fraction of the chosen speed. */
  hiddenSpeedFactor: 0.25,
  /** How often the hidden-tab timer asks for a catch-up step (browsers may call it less often). */
  hiddenStepIntervalMs: 1000,
  /** Longest stretch of real time a single catch-up step will simulate. */
  maxCatchUpSeconds: 60,
  /** The "while you were away" notice appears only after the tab was hidden at least this long. */
  awayNoticeSeconds: 300,
  /** Upper bound of ticks simulated in one visible frame, so a slow frame cannot snowball. */
  maxTicksPerFrame: 40,
  autoSaveIntervalSeconds: 30,
} as const;

export type AppConfig = typeof APP_CONFIG;
