export interface GeoPointInput {
  id: string;
  lat: number;
  lng: number;
}

export interface AccidentCluster {
  centerLat: number;
  centerLng: number;
  pointIds: string[];
  count: number;
  radiusMeters: number;
}

const EARTH_RADIUS_METERS = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineMeters(a: GeoPointInput, b: GeoPointInput): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

class DisjointSet {
  private parent: Map<string, string> = new Map();

  find(id: string): string {
    if (!this.parent.has(id)) this.parent.set(id, id);
    const p = this.parent.get(id)!;
    if (p === id) return id;
    const root = this.find(p);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

/**
 * Detects repeated-accident blackspots ("titik rawan"): groups points that
 * are mutually within `radiusMeters` of at least one other point in the
 * group (connected-component clustering via union-find on a proximity
 * graph), then keeps only groups with at least `minPoints` points.
 *
 * Pure function - no DB access - so it's directly unit-testable.
 */
export function detectClusters(
  points: GeoPointInput[],
  radiusMeters = 500,
  minPoints = 5
): AccidentCluster[] {
  const dsu = new DisjointSet();

  for (let i = 0; i < points.length; i++) {
    dsu.find(points[i].id);
    for (let j = i + 1; j < points.length; j++) {
      if (haversineMeters(points[i], points[j]) <= radiusMeters) {
        dsu.union(points[i].id, points[j].id);
      }
    }
  }

  const groups = new Map<string, GeoPointInput[]>();
  for (const point of points) {
    const root = dsu.find(point.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(point);
  }

  const clusters: AccidentCluster[] = [];
  for (const group of groups.values()) {
    if (group.length < minPoints) continue;

    const centerLat = group.reduce((sum, p) => sum + p.lat, 0) / group.length;
    const centerLng = group.reduce((sum, p) => sum + p.lng, 0) / group.length;

    clusters.push({
      centerLat,
      centerLng,
      pointIds: group.map((p) => p.id),
      count: group.length,
      radiusMeters,
    });
  }

  clusters.sort((a, b) => b.count - a.count);
  return clusters;
}
