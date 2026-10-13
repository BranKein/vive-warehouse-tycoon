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
