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

function polygonArea(points: Point[]) {
  return Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2);
}

function stitch(segments: Segment[]): Point[][] {
  const byStart = new Map<string, Segment[]>();
  for (const s of segments) byStart.set(key(s[0]), [...(byStart.get(key(s[0])) || []), s]);
  const used = new Set<Segment>();
  const paths: Point[][] = [];
  for (const first of segments) {
    if (used.has(first)) continue;
    used.add(first);
    const path = [first[0], first[1]];
    let cursor = first[1];
    while (key(cursor) !== key(path[0])) {
      const next = (byStart.get(key(cursor)) || []).find(s => !used.has(s));
      if (!next) break;
      used.add(next);
      path.push(next[1]);
      cursor = next[1];
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
  const tolerance = settings.mode === "precision" ? settings.simplification * 0.35 : settings.mode === "cnc" ? settings.simplification * 1.8 : settings.simplification;
  const paths: VectorPath[] = stitch(segments)
    .filter(p => polygonArea(p) >= settings.minArea)
    .map(p => {
      const closed = key(p[0]) === key(p[p.length - 1]);
      const core = closed ? p.slice(0, -1) : p;
      const simplified = simplifyPath(core, tolerance);
      const points = closed && simplified.length >= 3 ? [...simplified, simplified[0]] : simplified;
      return { points, closed: settings.closePaths || closed, layer: polygonArea(p) > width * height * 0.002 ? "CONTOURS" : "DETAILS" };
    });
  return { width, height, sourceWidth: width, sourceHeight: height, unit: "px", paths };
}

export function scaleDocument(doc: VectorDocument, width: number, height: number, unit: VectorDocument["unit"]): VectorDocument {
  const sx = width / doc.sourceWidth, sy = height / doc.sourceHeight;
  return { ...doc, width, height, unit, paths: doc.paths.map(path => ({ ...path, points: path.points.map(p => ({ x: p.x * sx, y: p.y * sy })) })) };
}
