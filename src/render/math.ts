/**
 * Pure calculations used by the renderer. Nothing here touches Three.js or
 * the DOM, so everything can be unit tested in Node.
 */

export const TAU = Math.PI * 2;

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const clamp01 = (value: number): number => clamp(value, 0, 1);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (t: number): number => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};

/** Overshoots slightly past 1 before settling; used for pop-in animations. */
export const easeOutBack = (t: number): number => {
  const k = clamp01(t) - 1;
  const s = 1.70158;
  return 1 + k * k * ((s + 1) * k + s);
};

/** Wraps an angle into (-PI, PI]. */
export function wrapAngle(angle: number): number {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

/** Interpolates between two angles along the shorter way round. */
export function lerpAngle(from: number, to: number, t: number): number {
  return from + wrapAngle(to - from) * t;
}

/** Moves `current` towards `target` by at most `maxStep`, along the shorter way round. */
export function turnTowards(current: number, target: number, maxStep: number): number {
  const delta = wrapAngle(target - current);
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

/** Frame-rate independent exponential smoothing. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Deterministic pseudo random value in [0, 1) for an integer pair. */
export function hash01(a: number, b = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Stable integer hash of a string (FNV-1a). */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small seeded generator (mulberry32) for scenery placement. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Quantities
// ---------------------------------------------------------------------------

/** The two fields of `BigNum` the renderer needs (value = m * 10^e). */
export interface Magnitude {
  readonly m: number;
  readonly e: number;
}

/** log10 of a quantity; -Infinity for zero and negative values. */
export function log10Of(amount: Magnitude): number {
  if (!(amount.m > 0)) return -Infinity;
  return Math.log10(amount.m) + amount.e;
}

export interface PileRule {
  maxCrates: number;
  cratesPerDecade: number;
}

/**
 * Number of crates that stand for a quantity. One crate is a bundle of goods:
 * anything above zero shows one crate, every tenfold increase adds
 * `cratesPerDecade` more, and the pile stops growing at `maxCrates`.
 */
export function pileCrateCount(amount: Magnitude, rule: PileRule): number {
  const log = log10Of(amount);
  if (log === -Infinity) return 0;
  if (log <= 0) return Math.min(1, rule.maxCrates);
  return clamp(1 + Math.floor(log * rule.cratesPerDecade), 1, rule.maxCrates);
}

/** Layers needed to stack `count` crates with `side * side` crates per layer. */
export function pileLayers(count: number, side: number): number {
  return Math.ceil(count / (side * side));
}

/** Position of the n-th crate of a pile, in units of one crate, relative to the centre of the pallet top. */
export function pileSlot(index: number, side: number): { col: number; row: number; layer: number } {
  const perLayer = side * side;
  const layer = Math.floor(index / perLayer);
  const inLayer = index % perLayer;
  return {
    col: (inLayer % side) - (side - 1) / 2,
    row: Math.floor(inLayer / side) - (side - 1) / 2,
    layer,
  };
}

/** Number of waste blobs for a waste ratio (1 = the point where the penalty starts). */
export function wasteBlobCount(ratio: number, maxBlobs: number, fullRatio: number): number {
  if (!(ratio > 0)) return 0;
  return clamp(Math.ceil((ratio / fullRatio) * maxBlobs), 1, maxBlobs);
}

export interface PileHeightRule {
  /** Height of a pile holding one unit or less. */
  minHeight: number;
  heightPerDecade: number;
  maxHeight: number;
}

/**
 * Height of the single box that stands for a quantity: zero for nothing,
 * `minHeight` up to one unit, then `heightPerDecade` more for every tenfold
 * increase, capped at `maxHeight`.
 */
export function pileHeight(amount: Magnitude, rule: PileHeightRule): number {
  const log = log10Of(amount);
  if (log === -Infinity || Number.isNaN(log)) return 0;
  return clamp(rule.minHeight + Math.max(0, log) * rule.heightPerDecade, rule.minHeight, rule.maxHeight);
}

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

export interface Pose {
  x: number;
  y: number;
  z: number;
  heading: number;
}

/**
 * Pose of a vehicle between two ticks. A vehicle that was not there on the
 * previous tick, or that jumped further than `snapDistance`, is drawn at its
 * current pose.
 */
export function interpolatePose(prev: Pose | undefined, curr: Pose, alpha: number, snapDistance: number): Pose {
  if (!prev) return { x: curr.x, y: curr.y, z: curr.z, heading: curr.heading };
  const distance = Math.hypot(curr.x - prev.x, curr.y - prev.y, curr.z - prev.z);
  if (distance > snapDistance) return { x: curr.x, y: curr.y, z: curr.z, heading: curr.heading };
  const t = clamp01(alpha);
  return {
    x: lerp(prev.x, curr.x, t),
    y: lerp(prev.y, curr.y, t),
    z: lerp(prev.z, curr.z, t),
    heading: lerpAngle(prev.heading, curr.heading, t),
  };
}

export interface BounceRule {
  durationSec: number;
  amplitude: number;
  frequency: number;
}

/**
 * Vertical stretch factor of the click bounce, `elapsed` seconds after the
 * click: a decaying wobble around 1 that is exactly 1 before and after.
 */
export function bounceStretch(elapsed: number, rule: BounceRule): number {
  if (elapsed <= 0 || elapsed >= rule.durationSec) return 1;
  const t = elapsed / rule.durationSec;
  const decay = (1 - t) * (1 - t);
  return 1 + rule.amplitude * decay * Math.sin(t * rule.frequency * TAU);
}

/** Sideways scale that keeps the volume roughly constant for a vertical stretch. */
export const squashFor = (stretch: number): number => 1 / Math.sqrt(Math.max(0.05, stretch));

/** Rotates a point given in an object's local frame (heading 0 = +z) into world offsets. */
export function rotateLocal(x: number, z: number, heading: number): { x: number; z: number } {
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  return { x: x * cos + z * sin, z: -x * sin + z * cos };
}

/** Heading (0 = +z) of the direction from one point to another. */
export const headingOf = (dx: number, dz: number): number => Math.atan2(dx, dz);

export interface PathSample {
  x: number;
  z: number;
  heading: number;
  /** Index of the segment the sample lies on. */
  segment: number;
  /** Distance to the nearer end of that segment. */
  toWaypoint: number;
}

/** Samples a closed loop of 2D points at `distance` along its length (wraps around). */
export function sampleLoop(points: ReadonlyArray<readonly [number, number]>, distance: number): PathSample {
  const count = points.length;
  if (count === 0) return { x: 0, z: 0, heading: 0, segment: 0, toWaypoint: 0 };
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % count]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(length);
    total += length;
  }
  if (total === 0) return { x: points[0]![0], z: points[0]![1], heading: 0, segment: 0, toWaypoint: 0 };
  let remaining = ((distance % total) + total) % total;
  for (let i = 0; i < count; i += 1) {
    const length = lengths[i]!;
    if (remaining <= length || i === count - 1) {
      const a = points[i]!;
      const b = points[(i + 1) % count]!;
      const k = length === 0 ? 0 : Math.min(1, remaining / length);
      return {
        x: lerp(a[0], b[0], k),
        z: lerp(a[1], b[1], k),
        heading: headingOf(b[0] - a[0], b[1] - a[1]),
        segment: i,
        toWaypoint: Math.min(remaining, length - remaining),
      };
    }
    remaining -= length;
  }
  return { x: points[0]![0], z: points[0]![1], heading: 0, segment: 0, toWaypoint: 0 };
}

export function loopLength(points: ReadonlyArray<readonly [number, number]>): number {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export interface OrbitLimits {
  minPitch: number;
  maxPitch: number;
  minDistance: number;
  maxDistance: number;
}

export interface OrbitState {
  /** Angle around the vertical axis; 0 looks from +z towards the centre. */
  yaw: number;
  /** Angle above the horizon. */
  pitch: number;
  distance: number;
}

export const clampPitch = (pitch: number, limits: OrbitLimits): number =>
  clamp(pitch, limits.minPitch, limits.maxPitch);

export const clampDistance = (distance: number, limits: OrbitLimits): number =>
  clamp(distance, limits.minDistance, limits.maxDistance);

/** Applies a right-button drag of (dx, dy) pixels. Dragging down raises the camera. */
export function orbitDrag(state: OrbitState, dx: number, dy: number, rotateSpeed: number, limits: OrbitLimits): OrbitState {
  return {
    yaw: state.yaw - dx * rotateSpeed,
    pitch: clampPitch(state.pitch + dy * rotateSpeed, limits),
    distance: state.distance,
  };
}

/** Applies a wheel movement; positive `lines` (scrolling down) zooms out. */
export function orbitZoom(state: OrbitState, lines: number, zoomStep: number, limits: OrbitLimits): OrbitState {
  return {
    yaw: state.yaw,
    pitch: state.pitch,
    distance: clampDistance(state.distance * Math.pow(zoomStep, lines), limits),
  };
}

/** Camera position for an orbit state around `target`. */
export function orbitPosition(
  state: OrbitState,
  target: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const horizontal = Math.cos(state.pitch) * state.distance;
  return {
    x: target.x + Math.sin(state.yaw) * horizontal,
    y: target.y + Math.sin(state.pitch) * state.distance,
    z: target.z + Math.cos(state.yaw) * horizontal,
  };
}

/** 0 while the player is active, ramping to 1 once the idle delay has passed. */
export function idleBlend(secondsSinceInput: number, delaySec: number, rampSec: number): number {
  if (secondsSinceInput <= delaySec) return 0;
  return smoothstep((secondsSinceInput - delaySec) / rampSec);
}

// ---------------------------------------------------------------------------
// Picking
// ---------------------------------------------------------------------------

/** True when a press and its release are close enough together to be a click rather than a drag. */
export function isClick(pressX: number, pressY: number, releaseX: number, releaseY: number, maxTravelPx: number): boolean {
  return Math.hypot(releaseX - pressX, releaseY - pressY) <= maxTravelPx;
}

/** Converts a pointer position to normalized device coordinates (-1..1, +y up) of an element's box. */
export function pointerToNdc(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (!(rect.width > 0) || !(rect.height > 0)) return { x: 0, y: 0 };
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: 1 - ((clientY - rect.top) / rect.height) * 2,
  };
}

export interface Ray {
  ox: number;
  oy: number;
  oz: number;
  /** Normalized direction. */
  dx: number;
  dy: number;
  dz: number;
}

/** Distance along the ray to a sphere, or null when it misses. */
export function raySphere(ray: Ray, cx: number, cy: number, cz: number, radius: number): number | null {
  const lx = cx - ray.ox;
  const ly = cy - ray.oy;
  const lz = cz - ray.oz;
  const along = lx * ray.dx + ly * ray.dy + lz * ray.dz;
  const distSq = lx * lx + ly * ly + lz * lz - along * along;
  const radiusSq = radius * radius;
  if (distSq > radiusSq) return null;
  const half = Math.sqrt(radiusSq - distSq);
  const near = along - half;
  if (near >= 0) return near;
  const far = along + half;
  return far >= 0 ? far : null;
}

export interface YawBox {
  cx: number;
  cy: number;
  cz: number;
  hx: number;
  hy: number;
  hz: number;
  /** Rotation around the vertical axis (heading convention: 0 = +z). */
  yaw: number;
}

/** Distance along the ray to a box rotated around the vertical axis, or null when it misses. */
export function rayYawBox(ray: Ray, box: YawBox): number | null {
  // Bring the ray into the box frame (inverse rotation).
  const sin = Math.sin(box.yaw);
  const cos = Math.cos(box.yaw);
  const px = ray.ox - box.cx;
  const pz = ray.oz - box.cz;
  const origin = [px * cos - pz * sin, ray.oy - box.cy, px * sin + pz * cos];
  const dir = [ray.dx * cos - ray.dz * sin, ray.dy, ray.dx * sin + ray.dz * cos];
  const half = [box.hx, box.hy, box.hz];
  let tMin = -Infinity;
  let tMax = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    const o = origin[axis]!;
    const d = dir[axis]!;
    const h = half[axis]!;
    if (Math.abs(d) < 1e-9) {
      if (o < -h || o > h) return null;
      continue;
    }
    let t1 = (-h - o) / d;
    let t2 = (h - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  if (tMax < 0) return null;
  return tMin >= 0 ? tMin : tMax;
}

export type PickShape =
  | { shape: 'sphere'; cx: number; cy: number; cz: number; radius: number }
  | ({ shape: 'box' } & YawBox);

export interface PickProxy<T> {
  target: T;
  /** Proxies with a higher priority win over nearer ones with a lower priority. */
  priority: number;
  volume: PickShape;
}

/** Returns the hit proxy with the highest priority, nearest first within a priority. */
export function pickNearest<T>(ray: Ray, proxies: ReadonlyArray<PickProxy<T>>): PickProxy<T> | null {
  let best: PickProxy<T> | null = null;
  let bestDistance = Infinity;
  for (const proxy of proxies) {
    const v = proxy.volume;
    const distance = v.shape === 'sphere' ? raySphere(ray, v.cx, v.cy, v.cz, v.radius) : rayYawBox(ray, v);
    if (distance === null) continue;
    if (
      best === null ||
      proxy.priority > best.priority ||
      (proxy.priority === best.priority && distance < bestDistance)
    ) {
      best = proxy;
      bestDistance = distance;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/** Distance from a point to a line segment on the ground plane. */
export function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq === 0 ? 0 : clamp01(((px - ax) * dx + (pz - az) * dz) / lengthSq);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** True when the point lies inside the rectangle grown by `margin` on every side. */
export function insideRect(
  x: number,
  z: number,
  rect: { minX: number; maxX: number; minZ: number; maxZ: number },
  margin = 0,
): boolean {
  return x >= rect.minX - margin && x <= rect.maxX + margin && z >= rect.minZ - margin && z <= rect.maxZ + margin;
}

/** Scale of something popping into existence: 0 at the start, a small overshoot, then 1. */
export function appearScale(elapsed: number, durationSec: number): number {
  if (elapsed >= durationSec) return 1;
  if (elapsed <= 0) return 0;
  return easeOutBack(elapsed / durationSec);
}

/** Scale of something shrinking away: 1 at the start, 0 once the duration has passed. */
export function vanishScale(elapsed: number, durationSec: number): number {
  if (elapsed <= 0) return 1;
  if (elapsed >= durationSec) return 0;
  return 1 - smoothstep(elapsed / durationSec);
}
