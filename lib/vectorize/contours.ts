import { chaikin, joinNearbyPaths } from "@/lib/vectorize/geometry";
import type { Point, VectorDocument, VectorPath, VectorSettings } from "@/types/vector";

type Segment = [Point, Point];
const key = (p: Point) => `${p.x},${p.y}`;

export function simplifyPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2 || tolerance <= 0) return points;
  const first = points[0], last = points[points.length - 1];
  let max = 0, index = 0;
  const dx = last.x - first.x, dy = last.y - first.y;
  const den = Math.sqrt(dx * dx + dy * dy) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const d = Math.abs(dy * points[i].x - dx * points[i].y + last.x * first.y - last.y * first.x) / den;
    if (d > max) { max = d; index = i; }
  }
  if (max > tolerance) {
    const left = simplifyPath(points.slice(0, index + 1), tolerance);
    const right = simplifyPath(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function simplifyClosed(points: Point[], tolerance: number) {
  if (points.length < 6 || tolerance <= 0) return points;
  const middle = Math.floor(points.length / 2);
  const left = simplifyPath(points.slice(0, middle + 1), tolerance);
  const right = simplifyPath([...points.slice(middle), points[0]], tolerance);
  return [...left.slice(0, -1), ...right.slice(0, -1)];
}

function polygonArea(points: Point[]) {
  return Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2);
}

function stitch(segments: Segment[]): Point[][] {
  const byStart = new Map<string, Segment[]>();
  for (const segment of segments) byStart.set(key(segment[0]), [...(byStart.get(key(segment[0])) || []), segment]);
  const used = new Set<Segment>(), paths: Point[][] = [];
  for (const first of segments) {
    if (used.has(first)) continue;
    used.add(first);
    const path = [first[0], first[1]];
    while (key(path[path.length - 1]) !== key(path[0])) {
      const next = (byStart.get(key(path[path.length - 1])) || []).find(segment => !used.has(segment));
      if (!next) break;
      used.add(next); path.push(next[1]);
    }
    paths.push(path);
  }
  return paths;
}

export function vectorizeBitmap(data: Uint8Array, width: number, height: number, settings: VectorSettings): VectorDocument {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && data[y * width + x] === 1;
  const segments: Segment[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!on(x, y)) continue;
    if (!on(x, y - 1)) segments.push([{ x, y }, { x: x + 1, y }]);
    if (!on(x + 1, y)) segments.push([{ x: x + 1, y }, { x: x + 1, y: y + 1 }]);
    if (!on(x, y + 1)) segments.push([{ x: x + 1, y: y + 1 }, { x, y: y + 1 }]);
    if (!on(x - 1, y)) segments.push([{ x, y: y + 1 }, { x, y }]);
  }
  const raw = stitch(segments);
  const closed = raw.filter(path => key(path[0]) === key(path[path.length - 1]));
  const open = joinNearbyPaths(raw.filter(path => key(path[0]) !== key(path[path.length - 1])), settings.joinDistance);
  const tolerance = settings.outputMode === "pixel" ? 0 : settings.mode === "precision" ? settings.simplification * .4 : settings.outputMode === "cad" ? settings.simplification * 1.5 : settings.simplification;
  const paths: VectorPath[] = [...closed, ...open]
    .filter(path => polygonArea(path) >= settings.minArea || key(path[0]) !== key(path[path.length - 1]))
    .map(path => {
      let isClosed = key(path[0]) === key(path[path.length - 1]);
      let points = isClosed ? path.slice(0, -1) : path;
      if (!isClosed && settings.closePaths && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) <= settings.joinDistance) isClosed = true;
      points = isClosed ? simplifyClosed(points, tolerance) : simplifyPath(points, tolerance);
      if (settings.outputMode !== "pixel" && settings.smoothIterations > 0) points = chaikin(points, isClosed, settings.smoothIterations);
      const layer: VectorPath["layer"] = polygonArea(points) > width * height * .002 ? "CONTOURS" : "DETAILS";
      return { points, closed: isClosed, curved: settings.outputMode === "smooth" && settings.smoothIterations > 0, layer };
    })
    .filter(path => path.points.length >= (path.closed ? 3 : 2));
  return { width, height, sourceWidth: width, sourceHeight: height, unit: "px", paths };
}

export function scaleDocument(doc: VectorDocument, width: number, height: number, unit: VectorDocument["unit"]): VectorDocument {
  const sx = width / doc.sourceWidth, sy = height / doc.sourceHeight;
  return { ...doc, width, height, unit, paths: doc.paths.map(path => ({ ...path, points: path.points.map(point => ({ x: point.x * sx, y: point.y * sy })) })) };
}
