import type { CadPoint } from "@/types/cad-geometry";

export function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function clonePoint(point: CadPoint): CadPoint {
  return { x: point.x, y: point.y };
}

export function distance(left: CadPoint, right: CadPoint) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

export function pathLength(points: CadPoint[]) {
  return points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
}

export function boundsDiagonal(points: CadPoint[]) {
  if (!points.length) return 0;
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

export function meanPoint(points: CadPoint[]): CadPoint {
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / Math.max(points.length, 1), y: total.y / Math.max(points.length, 1) };
}

export function normalizeAngle(angle: number) {
  const fullTurn = Math.PI * 2;
  const normalized = angle % fullTurn;
  return normalized < 0 ? normalized + fullTurn : normalized;
}
