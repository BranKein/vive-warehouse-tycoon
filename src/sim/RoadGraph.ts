import type { IslandLayoutDef, RoadNodeId, Vec3 } from '@/contracts';

/** A polyline with precomputed lengths, travelled by vehicles. */
export interface Path {
  points: readonly Vec3[];
  /** Distance from the first point to point i. */
  cumulative: readonly number[];
  length: number;
  /** Like `cumulative`, with each stretch counted `pace` times over: how long it takes, in units of distance. */
  timeline: readonly number[];
  /** Length the travel time is worked out from: `length` with slow stretches counted longer. */
  duration: number;
}

/** A point of a path. `pace` above 1 makes the stretch that ends at it that many times slower to travel. */
export type PathPoint = Vec3 & { pace?: number };

export function makePath(points: readonly PathPoint[]): Path {
  const cumulative = [0];
  const timeline = [0];
  let length = 0;
  let duration = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const step = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    length += step;
    duration += step * Math.max(1, b.pace ?? 1);
    cumulative.push(length);
    timeline.push(duration);
  }
  return { points, cumulative, length, timeline, duration };
}

/** Distance along the path after fraction `t` (0..1) of the time it takes to travel. */
export function distanceAt(path: Path, t: number): number {
  const target = Math.min(1, Math.max(0, t)) * path.duration;
  let segment = 1;
  while (segment < path.points.length - 1 && path.timeline[segment]! < target) segment += 1;
  const start = path.timeline[segment - 1] ?? 0;
  const span = (path.timeline[segment] ?? start) - start;
  const from = path.cumulative[segment - 1] ?? 0;
  const to = path.cumulative[segment] ?? from;
  return span === 0 ? to : from + (to - from) * Math.min(1, (target - start) / span);
}

/** The same way travelled backwards; each stretch keeps its pace. */
export const reversePath = (path: Path): Path => {
  const points = path.points as readonly PathPoint[];
  return makePath(points.map((_, i) => ({ ...points[points.length - 1 - i]!, pace: points[points.length - i]?.pace })));
};

export interface Pose {
  x: number;
  y: number;
  z: number;
  /** Radians, 0 = facing +z. */
  heading: number;
}

/** Position and heading at fraction `t` (0..1) of the path. */
export function poseAt(path: Path, t: number): Pose {
  const points = path.points;
  const first = points[0]!;
  if (points.length === 1 || path.length === 0) {
    const next = points[1] ?? first;
    return { x: first.x, y: first.y, z: first.z, heading: Math.atan2(next.x - first.x, next.z - first.z) };
  }
  const target = Math.min(1, Math.max(0, t)) * path.length;
  let segment = 1;
  while (segment < points.length - 1 && path.cumulative[segment]! < target) segment += 1;
  const a = points[segment - 1]!;
  const b = points[segment]!;
  const start = path.cumulative[segment - 1]!;
  const span = path.cumulative[segment]! - start;
  const k = span === 0 ? 0 : (target - start) / span;
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
    heading: Math.atan2(b.x - a.x, b.z - a.z),
  };
}

/** Shortest paths over the island's road network (all pairs, computed once). */
export class RoadGraph {
  private readonly ids: RoadNodeId[];
  private readonly indexOf = new Map<RoadNodeId, number>();
  private readonly points: Vec3[];
  private readonly dist: Float64Array;
  private readonly next: Int32Array;
  readonly size: number;

  constructor(layout: IslandLayoutDef) {
    this.ids = layout.roadNodes.map((node) => node.id);
    this.points = layout.roadNodes.map((node) => ({ x: node.x, y: 0, z: node.z }));
    this.ids.forEach((id, index) => this.indexOf.set(id, index));
    const n = (this.size = this.ids.length);
    this.dist = new Float64Array(n * n).fill(Infinity);
    this.next = new Int32Array(n * n).fill(-1);
    for (let i = 0; i < n; i += 1) {
      this.dist[i * n + i] = 0;
      this.next[i * n + i] = i;
    }
    for (const [a, b] of layout.roadEdges) {
      const i = this.index(a);
      const j = this.index(b);
      const length = Math.hypot(this.points[i]!.x - this.points[j]!.x, this.points[i]!.z - this.points[j]!.z);
      this.dist[i * n + j] = length;
      this.dist[j * n + i] = length;
      this.next[i * n + j] = j;
      this.next[j * n + i] = i;
    }
    // Floyd-Warshall; the graph has a few dozen nodes.
    for (let k = 0; k < n; k += 1) {
      for (let i = 0; i < n; i += 1) {
        const ik = this.dist[i * n + k]!;
        if (ik === Infinity) continue;
        for (let j = 0; j < n; j += 1) {
          const through = ik + this.dist[k * n + j]!;
          if (through < this.dist[i * n + j]!) {
            this.dist[i * n + j] = through;
            this.next[i * n + j] = this.next[i * n + k]!;
          }
        }
      }
    }
  }

  index(id: RoadNodeId): number {
    const index = this.indexOf.get(id);
    if (index === undefined) throw new Error(`Unknown road node: ${id}`);
    return index;
  }

  distance(from: number, to: number): number {
    return this.dist[from * this.size + to]!;
  }

  /** Road points from one node to another, both included. Empty when unreachable. */
  route(from: number, to: number): Vec3[] {
    if (this.next[from * this.size + to] === -1) return [];
    const points = [this.points[from]!];
    let at = from;
    while (at !== to) {
      at = this.next[at * this.size + to]!;
      points.push(this.points[at]!);
    }
    return points;
  }
}
