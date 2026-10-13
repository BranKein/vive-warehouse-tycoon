/**
 * The decisions ViewSync makes that do not need Three.js: what to create and
 * remove when the snapshot changes, and where each vehicle is drawn between
 * two ticks. Pure, so it is unit tested in Node.
 */
import { interpolatePose, type Pose } from './math';

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
