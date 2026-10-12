import type { IslandLayoutDef, RoadNodeId, Vec3 } from '@/contracts';

/** A polyline with precomputed lengths, travelled by vehicles. */
export interface Path {
  points: readonly Vec3[];
  /** Distance from the first point to point i. */
  cumulative: readonly number[];
  length: number;
}

export function makePath(points: readonly Vec3[]): Path {
  const cumulative = [0];
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    length += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    cumulative.push(length);
  }
  return { points, cumulative, length };
}

export const reversePath = (path: Path): Path => makePath([...path.points].reverse());

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
