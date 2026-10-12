import type { CommandResult, ContentCatalog, GameCommands, GameSnapshot, SaveController, Selection, UnlockView } from '@/contracts';
import type { Translator } from './text';

export type ToastKind = 'info' | 'good' | 'error';
export type TabId = 'build' | 'building' | 'unlocks' | 'upgrades';

/** Shared by every component of the UI. */
export interface UIContext {
  readonly catalog: ContentCatalog;
  readonly commands: GameCommands;
  readonly saves: SaveController;
  readonly tr: Translator;
  /** Changes the selection from the UI side and tells the rest of the app. */
  select(selection: Selection): void;
  /** Shows a failed command as a notification. Returns whether the command succeeded. */
  run(result: CommandResult): boolean;
  /** `render` is called again when the language changes. */
  notify(kind: ToastKind, render: () => string): void;
}

/** What a component gets on each update. Built once per frame. */
export interface Frame {
  readonly snapshot: GameSnapshot;
  readonly unlocks: ReadonlyMap<string, UnlockView>;
  readonly selection: Selection;
}
