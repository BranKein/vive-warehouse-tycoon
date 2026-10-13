import { describe, expect, it } from 'vitest';
import { bn } from '@/core/BigNum';
import { orbitGoal } from '@/render/CameraRig';
import { renderConfig } from '@/render/config';
import { keyframeSpan, sampleDayNight } from '@/render/dayNight';
import {
  clampPitch,
  interpolatePose,
  isClick,
  orbitDrag,
  orbitPan,
  orbitZoom,
  pickNearest,
  pileHeight,
  pointerToNdc,
  type PickProxy,
  type Ray,
} from '@/render/math';
import { defaultTheme } from '@/render/theme';

const rule = { minHeight: 0.4, heightPerDecade: 1, maxHeight: 5 };

describe('pileHeight', () => {
  it('is zero for nothing and the minimum up to one unit', () => {
    expect(pileHeight(bn(0), rule)).toBe(0);
    expect(pileHeight(bn(0.2), rule)).toBe(0.4);
    expect(pileHeight(bn(1), rule)).toBeCloseTo(0.4);
  });

  it('grows by a fixed step for every tenfold increase', () => {
    expect(pileHeight(bn(10), rule)).toBeCloseTo(1.4);
    expect(pileHeight(bn(100), rule)).toBeCloseTo(2.4);
    expect(pileHeight(bn(1000), rule) - pileHeight(bn(100), rule)).toBeCloseTo(1);
  });

  it('never decreases and stops at the maximum, even for huge amounts', () => {
    let last = 0;
    for (const amount of [0.5, 1, 3, 40, 900, 1e6]) {
      const height = pileHeight(bn(amount), rule);
      expect(height).toBeGreaterThanOrEqual(last);
      last = height;
    }
    expect(pileHeight(bn('1e300'), rule)).toBe(5);
    expect(pileHeight(bn('1e5000'), renderConfig.waste)).toBe(renderConfig.waste.maxHeight);
  });
});

describe('interpolatePose', () => {
  const a = { x: 0, y: 0, z: 0, heading: 0 };
  const b = { x: 4, y: 2, z: -8, heading: Math.PI / 2 };

  it('blends position and heading by alpha', () => {
    expect(interpolatePose(a, b, 0, 30)).toEqual(a);
    const mid = interpolatePose(a, b, 0.5, 30);
    expect(mid).toMatchObject({ x: 2, y: 1, z: -4 });
    expect(mid.heading).toBeCloseTo(Math.PI / 4);
    expect(interpolatePose(a, b, 1, 30).x).toBe(4);
  });

  it('clamps alpha outside 0..1', () => {
    expect(interpolatePose(a, b, 3, 30).x).toBe(4);
    expect(interpolatePose(a, b, -1, 30).x).toBe(0);
  });

  it('turns the short way round', () => {
    const from = { ...a, heading: Math.PI - 0.1 };
    const to = { ...a, heading: -Math.PI + 0.1 };
    const heading = interpolatePose(from, to, 0.5, 30).heading;
    expect(Math.abs(Math.cos(heading) + 1)).toBeLessThan(1e-9);
  });

  it('snaps when there is no previous pose or the jump is a teleport', () => {
    expect(interpolatePose(undefined, b, 0.2, 30)).toEqual(b);
    expect(interpolatePose(a, { ...b, x: 500 }, 0.2, 30).x).toBe(500);
  });
});

describe('click versus drag', () => {
  const max = renderConfig.click.maxTravelPx;

  it('accepts a press and release at nearly the same place', () => {
    expect(isClick(100, 100, 100, 100, max)).toBe(true);
    expect(isClick(100, 100, 103, 104, max)).toBe(true);
  });

  it('rejects a release further away than the limit', () => {
    expect(isClick(100, 100, 104, 104, max)).toBe(false);
    expect(isClick(100, 100, 100, 160, max)).toBe(false);
  });
});

describe('pointerToNdc', () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 };

  it('maps the corners and the centre of the element', () => {
    expect(pointerToNdc(10, 20, rect)).toEqual({ x: -1, y: 1 });
    expect(pointerToNdc(210, 120, rect)).toEqual({ x: 1, y: -1 });
    expect(pointerToNdc(110, 70, rect)).toEqual({ x: 0, y: 0 });
  });

  it('survives an element without a size', () => {
    expect(pointerToNdc(5, 5, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('pickNearest', () => {
  const down = (x: number, z: number): Ray => ({ ox: x, oy: 50, oz: z, dx: 0, dy: -1, dz: 0 });
  const proxies: Array<PickProxy<string>> = [
    { target: 'plot', priority: 0, volume: { shape: 'box', cx: 0, cy: 0, cz: 0, hx: 8, hy: 0.3, hz: 7, yaw: 0 } },
    { target: 'building', priority: 1, volume: { shape: 'box', cx: 0, cy: 2.5, cz: -2, hx: 5, hy: 2.5, hz: 3.5, yaw: 0 } },
    { target: 'special', priority: 2, volume: { shape: 'sphere', cx: 0, cy: 1.5, cz: 0, radius: 2 } },
  ];

  it('prefers the higher priority when several are hit', () => {
    expect(pickNearest(down(0, 0), proxies)?.target).toBe('special');
    expect(pickNearest(down(4, -3), proxies)?.target).toBe('building');
    expect(pickNearest(down(7, 6), proxies)?.target).toBe('plot');
  });

  it('reports nothing for a miss', () => {
    expect(pickNearest(down(40, 40), proxies)).toBeNull();
  });

  it('respects the rotation of a box', () => {
    const turned: Array<PickProxy<string>> = [
      { target: 'long', priority: 0, volume: { shape: 'box', cx: 0, cy: 0, cz: 0, hx: 1, hy: 1, hz: 10, yaw: Math.PI / 2 } },
    ];
    expect(pickNearest(down(8, 0), turned)?.target).toBe('long');
    expect(pickNearest(down(0, 8), turned)).toBeNull();
  });
});

describe('camera', () => {
  const c = renderConfig.camera;
  const limits = { minPitch: c.minPitch, maxPitch: c.maxPitch, minDistance: c.minDistance, maxDistance: c.maxDistance };
  const start = { yaw: 0, pitch: c.initialPitch, distance: c.initialDistance };

  it('keeps the pitch and the distance inside their limits', () => {
    expect(orbitDrag(start, 0, 1e6, c.rotateSpeed, limits).pitch).toBe(c.maxPitch);
    expect(orbitDrag(start, 0, -1e6, c.rotateSpeed, limits).pitch).toBe(c.minPitch);
    expect(orbitZoom(start, 500, c.zoomStep, limits).distance).toBe(c.maxDistance);
    expect(orbitZoom(start, -500, c.zoomStep, limits).distance).toBe(c.minDistance);
    expect(clampPitch(99, limits)).toBe(c.maxPitch);
  });

  it('pans so the ground follows the pointer, within the limit', () => {
    const centre = { x: 0, z: 0 };
    const view = { yaw: 0, pitch: Math.PI / 2, distance: 100 };
    // Looking straight down from the +z side: screen right is +x, screen down is +z.
    expect(orbitPan(centre, view, 10, 0, 0.5, centre, 100)).toEqual({ x: -5, z: 0 });
    const down = orbitPan(centre, view, 0, 10, 0.5, centre, 100);
    expect(down.x).toBeCloseTo(0);
    expect(down.z).toBeCloseTo(-5);
    // A flatter view covers more ground per vertical pixel.
    expect(orbitPan(centre, { ...view, pitch: Math.PI / 6 }, 0, 10, 0.5, centre, 100).z).toBeCloseTo(-10);
    expect(orbitPan(centre, view, -1e6, 0, 0.5, centre, 100).x).toBe(100);
    // Turned a quarter, the same drag moves along the other axis.
    expect(orbitPan(centre, { ...view, yaw: Math.PI / 2 }, 10, 0, 0.5, centre, 100).z).toBeCloseTo(5);
  });

  it('rotates around the centre with a horizontal drag', () => {
    const dragged = orbitDrag(start, 100, 0, c.rotateSpeed, limits);
    expect(dragged.yaw).toBeCloseTo(-100 * c.rotateSpeed);
    expect(dragged.pitch).toBe(start.pitch);
  });

  it('is the player view at blend 0 and the idle view at blend 1', () => {
    expect(orbitGoal(start, 0, 0, c.idle, limits)).toEqual(start);
    const idle = orbitGoal(start, 0.5, 1, c.idle, limits);
    expect(idle.yaw).toBeCloseTo(0.5);
    expect(idle.pitch).toBeCloseTo(c.idle.pitch);
    expect(idle.distance).toBeCloseTo(c.idle.distance);
  });
});

describe('day and night', () => {
  const keyframes = defaultTheme.dayNight.keyframes;

  it('wraps from the last keyframe to the first', () => {
    const last = keyframes.length - 1;
    expect(keyframeSpan(keyframes, 0.99)).toMatchObject({ from: last, to: 0 });
    const exact = keyframeSpan(keyframes, keyframes[1]!.at);
    expect(exact).toMatchObject({ from: 1, to: 2 });
    expect(exact.t).toBeCloseTo(0);
  });

  it('is day at noon and night late in the cycle', () => {
    expect(sampleDayNight(keyframes, 0.3).night).toBe(0);
    expect(sampleDayNight(keyframes, 0.85).night).toBe(1);
  });
});
