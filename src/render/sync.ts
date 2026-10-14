/**
 * The decisions ViewSync makes that do not need Three.js: what to create and
 * remove when the snapshot changes, and where each vehicle is drawn between
 * two ticks. Pure, so it is unit tested in Node.
 */
import { clamp01, interpolatePose, smoothstep, type Pose } from './math';

export interface KeyDiff {
  /** Wanted but not there yet, in the order they were asked for. */
  create: string[];
  /** There but no longer wanted. */
  remove: string[];
}

/** Compares the keys of the objects on screen with the keys the snapshot asks for. */
export function diffKeys(existing: Iterable<string>, wanted: Iterable<string>): KeyDiff {
  const have = new Set(existing);
  const want = new Set(wanted);
  const create: string[] = [];
  const remove: string[] = [];
  for (const key of want) if (!have.has(key)) create.push(key);
  for (const key of have) if (!want.has(key)) remove.push(key);
  return { create, remove };
}

/**
 * Identity of a building's scene object. It includes the type and the plot,
 * so a building that is replaced under the same id is rebuilt.
 */
export const buildingKey = (building: { id: string; typeId: string; plotId: string }): string =>
  `${building.id}|${building.typeId}|${building.plotId}`;

export interface VehicleLike extends Pose {
  id: string;
  model: string;
}

export interface DrawnVehicle {
  id: string;
  model: string;
  pose: Pose;
}

/**
 * Poses to draw for a frame that sits `alpha` (0..1) of the way from the
 * previous tick to the current one.
 *
 * - In both snapshots: interpolated (snapped if it jumped too far).
 * - Only in the current one (just appeared): drawn at its current pose.
 * - Only in the previous one (just left): not drawn.
 *
 * Pass `prev` as null when the two snapshots cannot be compared, e.g. they
 * show different islands.
 */
export function vehiclePoses(
  prev: ReadonlyArray<VehicleLike> | null,
  curr: ReadonlyArray<VehicleLike>,
  alpha: number,
  snapDistance: number,
): DrawnVehicle[] {
  const before = new Map<string, VehicleLike>();
  if (prev && prev !== curr) for (const vehicle of prev) before.set(vehicle.id, vehicle);
  return curr.map((vehicle) => ({
    id: vehicle.id,
    model: vehicle.model,
    pose: interpolatePose(before.get(vehicle.id), vehicle, alpha, snapDistance),
  }));
}

/**
 * Which stocks of a transport facility get a pile, given their sizes
 * (log10 of the amount, -Infinity for none) and the number of places.
 * Each stock keeps the place of its index while they all fit, so piles do not
 * shuffle around as goods come and go; when there are more kinds than places
 * the largest are shown, in their usual order.
 */
export function pilesToShow(sizes: ReadonlyArray<number>, places: number): number[] {
  const all = sizes.map((_, index) => index);
  if (all.length <= places) return all;
  const held = all.filter((index) => sizes[index]! > -Infinity);
  if (held.length <= places) return held;
  return held
    .sort((a, b) => sizes[b]! - sizes[a]! || a - b)
    .slice(0, places)
    .sort((a, b) => a - b);
}

/**
 * Sideways shift that puts a vehicle heading `heading` on the right-hand lane,
 * `lane` away from the centre line its path follows.
 */
export function laneShift(heading: number, lane: number): { x: number; z: number } {
  return { x: -Math.cos(heading) * lane, z: Math.sin(heading) * lane };
}

/**
 * How much of a vehicle is there, 0..1, when it has been on screen for `age`
 * seconds and, once it left the snapshot, has been gone for `gone` seconds
 * (negative while it is still there). Ships and planes use it as their
 * opacity, carriers as their size.
 */
export function vehicleFade(age: number, gone: number, appearSec: number, disappearSec: number): number {
  const grown = appearSec > 0 ? smoothstep(age / appearSec) : 1;
  if (gone < 0) return grown;
  return grown * (1 - smoothstep(disappearSec > 0 ? clamp01(gone / disappearSec) : 1));
}

/**
 * Where a parked road vehicle is drawn, as a shift from the loading point the
 * game puts it at: it stays on the lane it drove in on and pulls `inset`
 * further in, the way it was heading, so it stands on the site and off the road.
 */
export function parkedShift(heading: number, lane: number, inset: number): { x: number; z: number } {
  const side = laneShift(heading, lane);
  return { x: side.x + Math.sin(heading) * inset, z: side.z + Math.cos(heading) * inset };
}

/** A point on the way a road vehicle came, and how far it had travelled when it was there. */
export interface TrailPoint {
  x: number;
  z: number;
  d: number;
}

/**
 * Where a vehicle was when it had travelled `distance`, read off its trail.
 * Distances before the trail (or before `floor`) and after it give its ends.
 */
export function trailPoint(trail: ReadonlyArray<TrailPoint>, distance: number, floor = -Infinity): { x: number; z: number } {
  const last = trail[trail.length - 1]!;
  const d = Math.min(last.d, Math.max(distance, floor, trail[0]!.d));
  for (let index = trail.length - 1; index > 0; index -= 1) {
    const from = trail[index - 1]!;
    if (d < from.d) continue;
    const to = trail[index]!;
    const part = to.d > from.d ? (d - from.d) / (to.d - from.d) : 1;
    return { x: from.x + (to.x - from.x) * part, z: from.z + (to.z - from.z) * part };
  }
  return { x: trail[0]!.x, z: trail[0]!.z };
}

/**
 * Where a road vehicle is drawn when it is `at` along its trail: between the
 * points `reach` behind and ahead of it, facing from the one to the other, on
 * the right-hand lane. `heading` is kept when the two points meet.
 */
export function onTrail(
  trail: ReadonlyArray<TrailPoint>,
  at: number,
  reach: number,
  floor: number,
  lane: number,
  heading: number,
): { x: number; z: number; heading: number } {
  const rear = trailPoint(trail, at - reach, floor);
  const front = trailPoint(trail, at + reach, floor);
  if (Math.hypot(front.x - rear.x, front.z - rear.z) > 0.05) heading = Math.atan2(front.x - rear.x, front.z - rear.z);
  const side = laneShift(heading, lane);
  return { x: (rear.x + front.x) / 2 + side.x, z: (rear.z + front.z) / 2 + side.z, heading };
}

/** How the drawing of a road vehicle keeps pace with the game. */
export interface Cruise {
  /** How far behind the furthest it may be drawn it is kept, to have room to hurry on a right turn. */
  slack: number;
  /** Over how much of the way a gap from there is made up. */
  ease: number;
  /** Slowest and fastest it is drawn, relative to the game. */
  slowest: number;
  fastest: number;
}

/**
 * How far along its trail a road vehicle is drawn after the game moved it on
 * by `moved`, from `at`: it moves as far on screen as the game moved it, a
 * little slower or faster to stay `slack` behind `limit` (the furthest it may
 * be drawn). On the inner lane of a right turn its trail point moves much
 * faster than it does on screen, and on the outer lane of a left turn slower.
 * `stretch(at)` is how far on screen it moves per unit along the trail there.
 */
export function cruiseStep(at: number, moved: number, limit: number, stretch: (at: number) => number, rule: Cruise): number {
  if (moved <= 0) return at;
  const gap = limit - rule.slack - at;
  const pace = Math.min(rule.fastest, Math.max(rule.slowest, 1 + gap / rule.ease));
  const next = at + (moved * pace) / Math.max(0.2, stretch(at));
  return Math.max(at, Math.min(next, limit));
}

/** How far a vehicle moves on screen going from `from` to `to` along its trail, measured in steps of `step`. */
export function drawnLength(from: number, to: number, stretch: (at: number) => number, step: number): number {
  let length = 0;
  for (let at = from; at < to; at += step) length += stretch(at) * Math.min(step, to - at);
  return length;
}

/** The way a vehicle backs out of the site it was parked at. */
export interface BackOut {
  /** The way it stood: into the site. */
  heading: number;
  /** Where it stood. */
  x: number;
  z: number;
  /** How far it backs straight before the curve. */
  straight: number;
  /** The curve: how far it turns (radians, signed) and on what radius. */
  turn: number;
  radius: number;
}

/** A vehicle setting off from the site it was parked at. */
export interface Leaving extends BackOut {
  /** The distance it had travelled when it set off. */
  since: number;
  /** The distance at which it began to back out; null while it waits to learn which way the road leads. */
  from: number | null;
  /** Set when it crosses to the site straight across the road: the plan, how far along it is, and where it ends. */
  cross: { plan: Crossing; done: number; heading: number; pull: number } | null;
}

/**
 * A vehicle crossing the road to the site straight across from the one it
 * stood at: it backs out round a curve of `r1` until it faces along the road,
 * then drives forward round a curve of `r2` into the other site, with straight
 * stretches before and after. Worked out in the frame of the move: `u` from
 * where it stands towards where it will stand, `v` across.
 */
export interface Crossing {
  x: number;
  z: number;
  u: { x: number; z: number };
  v: { x: number; z: number };
  /** Which way across it swings: +1 or -1 along `v`. */
  side: number;
  straight1: number;
  r1: number;
  r2: number;
  straight2: number;
  length: number;
}

/**
 * Plans a crossing from where a vehicle stands (facing into its site) to where
 * it will stand across the road (facing into that site). Null when the two do
 * not face each other across a gap the curves fit in.
 */
export function planCrossing(
  from: { x: number; z: number; heading: number },
  to: { x: number; z: number },
  reverseRadius: number,
): Crossing | null {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const u = { x: -Math.sin(from.heading), z: -Math.cos(from.heading) };
  const v = { x: -u.z, z: u.x };
  const along = dx * u.x + dz * u.z;
  const across = dx * v.x + dz * v.z;
  const r1 = Math.min(reverseRadius, (along - Math.abs(across)) / 2);
  if (r1 <= 0.5) return null;
  const r2 = r1 + Math.abs(across);
  const rest = along - r1 - r2;
  const side = across > 0 ? -1 : 1;
  const straight1 = rest / 2;
  const straight2 = rest - straight1;
  return { x: from.x, z: from.z, u, v, side, straight1, r1, r2, straight2, length: rest + (Math.PI / 2) * (r1 + r2) };
}

/** Where a crossing vehicle is after `distance` of it, and which way it faces. */
export function crossingPose(c: Crossing, distance: number): { x: number; z: number; heading: number; done: boolean } {
  const s = Math.max(0, distance);
  const quarter = Math.PI / 2;
  const arc1 = quarter * c.r1;
  const arc2 = quarter * c.r2;
  let pu: number;
  let pv: number;
  let phi: number;
  if (s <= c.straight1) {
    [pu, pv, phi] = [s, 0, Math.PI];
  } else if (s <= c.straight1 + arc1) {
    const t = (s - c.straight1) / c.r1;
    [pu, pv, phi] = [c.straight1 + c.r1 * Math.sin(t), c.side * c.r1 * (1 - Math.cos(t)), Math.PI + c.side * t];
  } else if (s <= c.straight1 + arc1 + arc2) {
    const t = (s - c.straight1 - arc1) / c.r2;
    const u0 = c.straight1 + c.r1;
    const v0 = c.side * c.r1;
    [pu, pv, phi] = [u0 + c.r2 * (1 - Math.cos(t)), v0 - c.side * c.r2 * Math.sin(t), -c.side * (quarter - t)];
  } else {
    const rest = Math.min(s, c.length) - c.straight1 - arc1 - arc2;
    [pu, pv, phi] = [c.straight1 + c.r1 + c.r2 + rest, c.side * (c.r1 - c.r2), 0];
  }
  const face = { x: c.u.x * Math.cos(phi) + c.v.x * Math.sin(phi), z: c.u.z * Math.cos(phi) + c.v.z * Math.sin(phi) };
  return {
    x: c.x + c.u.x * pu + c.v.x * pv,
    z: c.z + c.u.z * pu + c.v.z * pv,
    heading: Math.atan2(face.x, face.z),
    done: s >= c.length,
  };
}

/**
 * Where a vehicle that is backing out is after `distance`: straight back
 * first, then backwards round a curve while it turns by `turn`, so it ends
 * facing the way it will drive. `done` once the curve is complete.
 */
export function backOutPose(leaving: BackOut, distance: number): { x: number; z: number; heading: number; done: boolean } {
  const h = leaving.heading;
  const straight = Math.min(distance, leaving.straight);
  const x = leaving.x - Math.sin(h) * straight;
  const z = leaving.z - Math.cos(h) * straight;
  if (distance <= leaving.straight) return { x, z, heading: h, done: false };
  const length = leaving.radius * Math.abs(leaving.turn);
  const part = length > 0 ? Math.min(1, (distance - leaving.straight) / length) : 1;
  const heading = h + leaving.turn * part;
  const side = Math.sign(leaving.turn) * leaving.radius;
  return {
    x: x - side * (Math.cos(h) - Math.cos(heading)),
    z: z - side * (Math.sin(heading) - Math.sin(h)),
    heading,
    done: part >= 1,
  };
}

/**
 * Dots along the rest of a vehicle's way: every `spacing` from `from` (a
 * distance along `points`) to the end, each on the right-hand lane of its
 * stretch. The last dot is the end of the way.
 */
export function routeDots(
  points: ReadonlyArray<{ x: number; z: number }>,
  from: number,
  spacing: number,
  lane: number,
): Array<{ x: number; z: number }> {
  const dots: Array<{ x: number; z: number }> = [];
  let start = 0;
  let next = Math.max(0, from);
  let last: { x: number; z: number } | null = null;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length === 0) continue;
    const side = laneShift(Math.atan2(b.x - a.x, b.z - a.z), lane);
    for (; next <= start + length; next += spacing) {
      const part = (next - start) / length;
      dots.push({ x: a.x + (b.x - a.x) * part + side.x, z: a.z + (b.z - a.z) * part + side.z });
    }
    start += length;
    last = { x: b.x + side.x, z: b.z + side.z };
  }
  if (last && from < start) dots.push(last);
  return dots;
}
