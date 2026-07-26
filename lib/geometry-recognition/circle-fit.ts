import type { CadPoint } from "@/types/cad-geometry";
import { clamp, distance, meanPoint, normalizeAngle } from "@/lib/geometry-recognition/geometry-utils";

export type CircleFitOptions = {
  maxRelativeResidual?: number;
  minimumRadius?: number;
  minimumCoverageRatio?: number;
  minimumPoints?: number;
};

export type CircleFitResult = {
  center: CadPoint;
  radius: number;
  residual: number;
  confidence: number;
  coverageRatio: number;
};

const defaults: Required<CircleFitOptions> = {
  maxRelativeResidual: 0.025,
  minimumRadius: 1,
  minimumCoverageRatio: 0.7,
  minimumPoints: 8,
};

/** Fits a circle with a centroid-shifted least-squares solution. */
export function fitCircle(points: CadPoint[], options: CircleFitOptions = {}): CircleFitResult | null {
  const settings = { ...defaults, ...options };
  if (points.length < settings.minimumPoints) return null;
  const mean = meanPoint(points);
  let suu = 0;
  let svv = 0;
  let suv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;

  for (const point of points) {
    const u = point.x - mean.x;
    const v = point.y - mean.y;
    const uu = u * u;
    const vv = v * v;
    suu += uu;
    svv += vv;
    suv += u * v;
    suuu += uu * u;
    svvv += vv * v;
    suvv += u * vv;
    svuu += v * uu;
  }

  const determinant = suu * svv - suv * suv;
  if (Math.abs(determinant) < Number.EPSILON) return null;
  const centerU = (svv * (suuu + suvv) - suv * (svvv + svuu)) / (2 * determinant);
  const centerV = (suu * (svvv + svuu) - suv * (suuu + suvv)) / (2 * determinant);
  const center = { x: mean.x + centerU, y: mean.y + centerV };
  const radii = points.map((point) => distance(point, center));
  const radius = radii.reduce((sum, value) => sum + value, 0) / radii.length;
  if (!Number.isFinite(radius) || radius < settings.minimumRadius) return null;

  const residual = Math.sqrt(radii.reduce((sum, value) => sum + (value - radius) ** 2, 0) / radii.length);
  const angles = points.map((point) => normalizeAngle(Math.atan2(point.y - center.y, point.x - center.x))).sort((left, right) => left - right);
  let largestGap = 0;
  for (let index = 0; index < angles.length; index += 1) {
    const next = index === angles.length - 1 ? angles[0] + Math.PI * 2 : angles[index + 1];
    largestGap = Math.max(largestGap, next - angles[index]);
  }
  const coverageRatio = clamp(1 - largestGap / (Math.PI * 2));
  const radialScore = clamp(1 - residual / Math.max(radius * settings.maxRelativeResidual, Number.EPSILON));
  const coverageScore = settings.minimumCoverageRatio > 0
    ? clamp(coverageRatio / settings.minimumCoverageRatio)
    : 1;

  return { center, radius, residual, confidence: radialScore * coverageScore, coverageRatio };
}
