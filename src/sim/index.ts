/**
 * Public face of the simulation. The app only needs `createGame`; tests and
 * the headless runner also use the `Game` class directly.
 */
import type { CreateGameOptions } from '@/contracts';
import { BALANCE, type Balance } from '@/content/balance';
import { Game } from './Game';

export { Game, SAVE_VERSION, type GameOptions } from './Game';
export { registerProductionLine } from './ProductionLine';
export { registerSaleChannel } from './channels';

export interface CreateSimOptions extends CreateGameOptions {
  /** Balance constants; defaults to the shipped ones. Tests pass their own. */
  balance?: Balance;
}

/**
 * Starts a new game, or restores one when `options.save` is given. The save
 * must already be at the current format version (run it through `migrate`
 * from `src/save` first). The result implements `GameEngine`.
 */
export function createGame(options: CreateSimOptions): Game {
  return new Game({ ...options, balance: options.balance ?? BALANCE });
}
