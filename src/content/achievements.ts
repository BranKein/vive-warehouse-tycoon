/**
 * Achievements. Each one reached adds a little to every sale price
 * (`BALANCE.achievements.saleBonusEach`). Goals are first guesses placed on the
 * auto-mode timeline (`npm run sim -- --hours 16 --auto --timeline`).
 * Names and descriptions are `achievement.<id>.name` / `.desc`.
 */
import type { AchievementDef, AchievementMetric, AchievementTier } from '@/contracts';

const TIERS: readonly AchievementTier[] = ['bronze', 'silver', 'gold'];

/** Three steps of one measure: bronze, silver, gold. */
const ladder = (group: string, metric: AchievementMetric, goals: readonly [number, number, number]): AchievementDef[] =>
  goals.map((goal, index) => ({ id: `${group}.${index + 1}`, group, tier: TIERS[index]!, metric, goal }));

const single = (id: string, tier: AchievementTier, metric: AchievementMetric, goal = 1): AchievementDef => ({
  id,
  group: 'milestones',
  tier,
  metric,
  goal,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  ...ladder('buildings', { kind: 'buildings' }, [10, 30, 59]),
  ...ladder('unlocks', { kind: 'unlocks' }, [3, 8, 17]),
  ...ladder('upgrades', { kind: 'upgrades' }, [100, 1000, 4000]),
  ...ladder('earned', { kind: 'earned' }, [1e6, 1e9, 1e12]),
  ...ladder('income', { kind: 'income' }, [1e3, 1e6, 1e9]),
  ...ladder('sales', { kind: 'sales' }, [100, 1000, 5000]),
  ...ladder('specialCargo', { kind: 'specialCargo' }, [5, 25, 100]),
  ...ladder('playTime', { kind: 'playSeconds' }, [3600, 4 * 3600, 12 * 3600]),
  single('firstWasteDisposal', 'bronze', { kind: 'category', category: 'disposal' }),
  single('firstTier2', 'bronze', { kind: 'category', category: 'tier2' }),
  single('firstTier3', 'silver', { kind: 'category', category: 'tier3' }),
  single('firstShipSale', 'silver', { kind: 'sales', channel: 'sale.ship' }),
  single('firstTier4', 'gold', { kind: 'category', category: 'tier4' }),
  single('firstPlaneSale', 'gold', { kind: 'sales', channel: 'sale.plane' }),
  single('firstHandmade', 'gold', { kind: 'category', category: 'handmade' }),
];
