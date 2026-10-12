import { describe, expect, it } from 'vitest';
import { catalog } from '@/content';
import { createFixtureSnapshot } from '@/dev/fixtures';

describe('fixture snapshot', () => {
  it('builds a consistent snapshot at any time', () => {
    for (const time of [0, 7.3, 120]) {
      const snapshot = createFixtureSnapshot(catalog, time);
      expect(snapshot.island.plots).toHaveLength(30);
      expect(snapshot.island.vehicles.length).toBeGreaterThan(0);
      for (const vehicle of snapshot.island.vehicles) {
        expect(Number.isFinite(vehicle.x + vehicle.y + vehicle.z + vehicle.heading)).toBe(true);
      }
      for (const building of snapshot.island.buildings) {
        expect(catalog.buildings[building.typeId]).toBeDefined();
      }
    }
  });
});
