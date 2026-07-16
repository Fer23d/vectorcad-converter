import type { Point, VectorDocument, VectorPath } from "@/types/vector";

export type VectorCleanupMode = "original" | "smooth" | "cad-clean";

export type VectorCleanupResult = {
  document: VectorDocument;
  beforePaths: number;
  afterPaths: number;
  beforePoints: number;
  afterPoints: number;
  reductionPercent: number;
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function perpendicularDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return distance(point, start);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / Math.hypot(dx, dy);
}

/** Douglas-Peucker simplification that preserves the first and last point. */
export function simplifyDouglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2 || tolerance <= 0) return points.map(point => ({ ...point }));
  let maxDistance = 0;
  let splitIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = perpendicularDistance(points[index], points[0], points[points.length - 1]);
    if (current > maxDistance) { maxDistance = current; splitIndex = index; }
  }
  if (maxDistance <= tolerance) return [{ ...points[0] }, { ...points[points.length - 1] }];
  const left = simplifyDouglasPeucker(points.slice(0, splitIndex + 1), tolerance);
  const right = simplifyDouglasPeucker(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function simplifyClosed(points: Point[], tolerance: number) {
  if (points.length < 4) return points.map(point => ({ ...point }));
  const open = points[0].x === points[points.length - 1].x && points[0].y === points[points.length - 1].y ? points.slice(0, -1) : points;
  const pivot = Math.floor(open.length / 2);
  const rotated = [...open.slice(pivot), ...open.slice(0, pivot), open[pivot]];
  const simplified = simplifyDouglasPeucker(rotated, tolerance);
  return simplified.slice(0, -1);
}

function removeCollinearPoints(points: Point[], tolerance: number, closed: boolean) {
  if (points.length < (closed ? 4 : 3)) return points;
  const result: Point[] = [];
  const count = points.length;
  for (let index = 0; index < count; index += 1) {
    if (!closed && (index === 0 || index === count - 1)) { result.push(points[index]); continue; }
    const previous = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    if (perpendicularDistance(current, previous, next) > tolerance) result.push(current);
  }
  return result.length >= (closed ? 3 : 2) ? result : points;
}

function pathLength(path: VectorPath) {
  return path.points.slice(1).reduce((total, point, index) => total + distance(path.points[index], point), 0);
}

function mergeable(left: VectorPath, right: VectorPath, tolerance: number) {
  if (left.closed || right.closed || left.curved || right.curved || left.layer !== right.layer) return false;
  const leftEnd = left.points[left.points.length - 1];
  const rightStart = right.points[0];
  if (distance(leftEnd, rightStart) > tolerance) return false;
  const leftPrevious = left.points[Math.max(0, left.points.length - 2)];
  const rightNext = right.points[Math.min(right.points.length - 1, 1)];
  const leftAngle = Math.atan2(leftEnd.y - leftPrevious.y, leftEnd.x - leftPrevious.x);
  const rightAngle = Math.atan2(rightNext.y - rightStart.y, rightNext.x - rightStart.x);
  const delta = Math.abs(Math.atan2(Math.sin(leftAngle - rightAngle), Math.cos(leftAngle - rightAngle)));
  return delta < Math.PI / 12 || Math.abs(delta - Math.PI) < Math.PI / 12;
}

function mergeCollinearPaths(paths: VectorPath[], tolerance: number) {
  const result: VectorPath[] = [];
  for (const path of paths) {
    const previous = result[result.length - 1];
    if (previous && mergeable(previous, path, tolerance)) {
      previous.points = [...previous.points, ...path.points.slice(1)];
    } else result.push({ ...path, points: path.points.map(point => ({ ...point })) });
  }
  return result;
}

function countPoints(paths: VectorPath[]) {
  return paths.reduce((total, path) => total + path.points.length, 0);
}

export function cleanupVectorDocument(document: VectorDocument, mode: VectorCleanupMode): VectorCleanupResult {
  const beforePaths = document.paths.length;
  const beforePoints = countPoints(document.paths);
  if (mode === "original") return { document, beforePaths, afterPaths: beforePaths, beforePoints, afterPoints: beforePoints, reductionPercent: 0 };

  const tolerance = mode === "cad-clean" ? 1.25 : .65;
  const cleaned = document.paths.flatMap(path => {
    const toleranceForPath = path.curved ? tolerance * .35 : tolerance;
    const simplified = path.closed ? simplifyClosed(path.points, toleranceForPath) : simplifyDouglasPeucker(path.points, toleranceForPath);
    const points = removeCollinearPoints(simplified, toleranceForPath * .6, path.closed);
    if (!path.closed && !path.curved && mode === "cad-clean" && pathLength({ ...path, points }) < toleranceForPath * 1.5) return [];
    return [{ ...path, points }];
  });
  const paths = mode === "cad-clean" ? mergeCollinearPaths(cleaned, tolerance * 1.5) : cleaned;
  const afterPoints = countPoints(paths);
  return {
    document: { ...document, paths },
    beforePaths,
    afterPaths: paths.length,
    beforePoints,
    afterPoints,
    reductionPercent: beforePoints ? Math.max(0, Math.round((1 - afterPoints / beforePoints) * 100)) : 0,
  };
}
