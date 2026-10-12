import { describe, expect, it } from 'vitest';
import { catalog } from '@/content';
import type { UpgradeView } from '@/contracts';
import { bn } from '@/core/BigNum';
import { createFixtureSnapshot } from '@/dev/fixtures';
import { I18n } from '@/i18n';
import {
  fillRatio,
  formatAmount,
  formatAutoStatus,
  formatAutoTarget,
  formatBuildingStatus,
  formatIncome,
  formatModifier,
  formatPercent,
  formatRecipeSide,
  formatSaveSummary,
  formatStock,
  formatUnlockGrant,
  formatUpgradeEffect,
  formatUpgradeLevel,
  formatUpgradeValue,
  formatWaste,
  missingRequirements,
  wasteLevel,
} from '@/ui/text';

const english = new I18n();
const korean = new I18n();
korean.setLanguage('ko');

const upgrade = (overrides: Partial<UpgradeView> = {}): UpgradeView => ({
  trackId: 'building.level',
  stat: 'batchSize',
  unit: 'multiplier',
  level: 3,
  maxLevel: null,
  cost: bn(1500),
  affordable: true,
  current: bn(1.5),
  next: bn(2.25),
  ...overrides,
});

describe('amounts', () => {
  it('uses AA notation without going through a JS number', () => {
    expect(formatAmount(bn(0))).toBe('0');
    expect(formatAmount(bn(999))).toBe('999');
    expect(formatAmount(bn(1234))).toBe('1.23K');
    expect(formatAmount(bn('4.2e7'))).toBe('42.0M');
    expect(formatAmount(bn('1e15'))).toBe('1.00aa');
    expect(formatAmount(bn('2.5e18'))).toBe('2.50ab');
    // Far beyond what a double can hold.
    expect(formatAmount(bn('1e400'))).not.toMatch(/Infinity|NaN/);
    expect(formatAmount(bn('7.77e3000'))).toMatch(/^7\.77[a-z]+$/);
  });

  it('formats income per second in each language', () => {
    expect(formatIncome(english, bn(1234))).toBe('+1.23K/s');
    expect(formatIncome(korean, bn(1234))).toBe('초당 +1.23K');
  });

  it('formats stock with and without a capacity', () => {
    expect(formatStock(english, bn(12), bn(40))).toBe('12 / 40');
    expect(formatStock(english, bn(1.2e6), null)).toBe('1.20M');
  });

  it('computes bar fill safely', () => {
    expect(fillRatio(bn(10), bn(40))).toBeCloseTo(0.25);
    expect(fillRatio(bn(100), bn(40))).toBe(1);
    expect(fillRatio(bn(10), null)).toBe(0);
    expect(fillRatio(bn(10), bn(0))).toBe(0);
    expect(fillRatio(bn('1e500'), bn('4e500'))).toBeCloseTo(0.25);
  });
});

describe('building status', () => {
  it('describes each status', () => {
    expect(formatBuildingStatus(english, { status: 'working', missingInputs: [] })).toBe('Working');
    expect(formatBuildingStatus(english, { status: 'idle', missingInputs: [] })).toBe('Idle');
    expect(formatBuildingStatus(english, { status: 'outputFull', missingInputs: [] })).toBe('Outbound stock is full');
  });

  it('names the inputs that are missing', () => {
    expect(formatBuildingStatus(english, { status: 'starved', missingInputs: ['lumber'] })).toBe('Waiting for Lumber');
    expect(formatBuildingStatus(english, { status: 'starved', missingInputs: ['lumber', 'fabric'] })).toBe(
      'Waiting for Lumber, Fabric',
    );
    expect(formatBuildingStatus(korean, { status: 'starved', missingInputs: ['lumber', 'fabric'] })).toBe('판재, 원단 부족');
    expect(formatBuildingStatus(english, { status: 'starved', missingInputs: [] })).toBe('Waiting for materials');
  });

  it('ignores missing inputs when the building is not starved', () => {
    expect(formatBuildingStatus(english, { status: 'working', missingInputs: ['lumber'] })).toBe('Working');
  });

  it('grades the waste level', () => {
    expect(wasteLevel(0)).toBe('none');
    expect(wasteLevel(Number.NaN)).toBe('none');
    expect(wasteLevel(0.4)).toBe('building');
    expect(wasteLevel(1)).toBe('clogged');
    expect(wasteLevel(1.3)).toBe('clogged');
    expect(formatPercent(0.404)).toBe('40');
    expect(formatWaste(english, 0.4)).toBe('40% of the limit');
    expect(formatWaste(english, 1.3)).toBe('130% of the limit: production is slowed down');
    expect(formatWaste(korean, 1.3)).toContain('130%');
  });

  it('describes modifiers, falling back to raw names for unknown ones', () => {
    expect(formatModifier(english, { source: 'wasteClogged', stat: 'cycleSpeed', multiplier: 0.5 })).toBe(
      'Clogged with waste: speed ×0.50',
    );
    expect(formatModifier(english, { source: 'festival', stat: 'luck', multiplier: 2 })).toBe('festival: luck ×2');
  });
});

describe('upgrades', () => {
  it('formats values by unit', () => {
    expect(formatUpgradeValue(english, 'multiplier', bn(1.5))).toBe('×1.50');
    expect(formatUpgradeValue(english, 'seconds', bn(12))).toBe('12s');
    expect(formatUpgradeValue(korean, 'seconds', bn(10.2))).toBe('10.2초');
    expect(formatUpgradeValue(english, 'count', bn(3))).toBe('3');
    expect(formatUpgradeValue(english, 'amount', bn('8e12'))).toBe('8.00T');
  });

  it('shows the effect now and after the next level', () => {
    expect(formatUpgradeEffect(english, upgrade())).toBe('×1.50 → ×2.25');
    expect(formatUpgradeEffect(english, upgrade({ next: null }))).toBe('×1.50');
  });

  it('shows the level with its cap when there is one', () => {
    expect(formatUpgradeLevel(english, upgrade())).toBe('Lv 3');
    expect(formatUpgradeLevel(english, upgrade({ maxLevel: 10 }))).toBe('Lv 3/10');
  });
});

describe('recipes and unlocks', () => {
  it('lists recipe sides', () => {
    expect(formatRecipeSide(english, catalog.recipes.furnitureFactory!.inputs)).toBe('Lumber ×2, Fabric ×1');
    expect(formatRecipeSide(korean, catalog.recipes.furnitureFactory!.outputs)).toBe('의자 ×1');
    expect(formatRecipeSide(english, catalog.recipes.wasteDisposal!.outputs)).toBe('Nothing');
  });

  it('describes what an unlock gives', () => {
    expect(formatUnlockGrant(english, catalog.unlocks['unlock.building.toolFactory']!)).toBe('Lets you build the Tool Factory.');
    expect(formatUnlockGrant(english, catalog.unlocks['unlock.channel.ship']!)).toBe('Opens a new way to sell: Cargo Ships.');
  });

  it('lists the prerequisites that are still locked', () => {
    expect(missingRequirements(catalog, 'unlock.channel.plane', () => false)).toEqual(['unlock.channel.ship']);
    expect(missingRequirements(catalog, 'unlock.channel.plane', () => true)).toEqual([]);
    expect(missingRequirements(catalog, 'unlock.channel.ship', () => false)).toEqual([]);
    expect(missingRequirements(catalog, 'unknown', () => false)).toEqual([]);
  });
});

describe('auto mode', () => {
  it('is silent while off and says so while choosing', () => {
    expect(formatAutoStatus(english, { enabled: false, target: null, targetCost: null })).toBe('');
    expect(formatAutoStatus(english, { enabled: true, target: null, targetCost: null })).toBe('Choosing the next goal…');
  });

  it('names the target and its cost, translating IDs in the params', () => {
    const target = { key: 'auto.target.upgradeBuilding', params: { building: 'sawmill', track: 'building.level' } };
    expect(formatAutoTarget(english, target)).toBe('Sawmill: Production Level');
    expect(formatAutoStatus(english, { enabled: true, target, targetCost: bn(2500) })).toBe(
      'Saving for: Sawmill: Production Level (2.50K)',
    );
    expect(formatAutoStatus(korean, { enabled: true, target: { key: 'auto.target.build', params: { building: 'sawmill' } }, targetCost: null })).toBe(
      '모으는 중: 제재소 건설',
    );
  });

  it('falls back when the simulation sends a key the UI does not know', () => {
    expect(formatAutoTarget(english, { key: 'something.new' })).toBe('Next purchase');
  });
});

describe('save summary', () => {
  it('formats money from its string form', () => {
    expect(formatSaveSummary(english, { money: '1.5e12', buildings: 4, playSeconds: 3725 })).toBe(
      '1.50T · 4 buildings · 1h 2m played',
    );
    expect(formatSaveSummary(english, { money: 'garbage', buildings: 0, playSeconds: 0 })).toContain('garbage');
  });
});

describe('fixture snapshot', () => {
  it('produces text for everything in it, in both languages, without leaking keys', () => {
    const snapshot = createFixtureSnapshot(catalog, 42);
    for (const tr of [english, korean]) {
      const texts = [
        ...snapshot.island.buildings.map((building) => formatBuildingStatus(tr, building)),
        ...snapshot.island.buildings.flatMap((building) => building.upgrades.map((view) => formatUpgradeEffect(tr, view))),
        ...snapshot.island.buildings.flatMap((building) => building.modifiers.map((modifier) => formatModifier(tr, modifier))),
        ...Object.values(catalog.recipes).flatMap((recipe) => [formatRecipeSide(tr, recipe.inputs), formatRecipeSide(tr, recipe.outputs)]),
        ...Object.values(catalog.unlocks).map((unlock) => formatUnlockGrant(tr, unlock)),
      ];
      for (const text of texts) {
        expect(text).not.toMatch(/\{\w+\}/);
        expect(text).not.toMatch(/\b(item|building|unlock|channel|stat|modifier)\.[\w.]+/);
      }
    }
  });
});
