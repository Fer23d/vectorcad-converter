import type { CadPoint } from "@/types/cad-geometry";
import { boundsDiagonal, clamp, meanPoint } from "@/lib/geometry-recognition/geometry-utils";

export type LineFitOptions = {
  maxAbsoluteResidual?: number;
  maxRelativeResidual?: number;
  minimumLength?: number;
};

export type LineFitResult = {
  start: CadPoint;
  end: CadPoint;
  residual: number;
  confidence: number;
  length: number;
};

const defaults: Required<LineFitOptions> = {
  maxAbsoluteResidual: 1.25,
  maxRelativeResidual: 0.0125,
  minimumLength: 2,
};

/** Fits a principal-component line and measures RMS perpendicular error. */
export function fitLine(points: CadPoint[], options: LineFitOptions = {}): LineFitResult | null {
  if (points.length < 2) return null;
  const settings = { ...defaults, ...options };
  const mean = meanPoint(points);
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const point of points) {
    const x = point.x - mean.x;
    const y = point.y - mean.y;
    xx += x * x;
    yy += y * y;
    xy += x * y;
  }

  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  let direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const first = points[0];
  const last = points[points.length - 1];
  if ((last.x - first.x) * direction.x + (last.y - first.y) * direction.y < 0) direction = { x: -direction.x, y: -direction.y };

  const projections = points.map((point) => (point.x - mean.x) * direction.x + (point.y - mean.y) * direction.y);
  const minimum = Math.min(...projections);
  const maximum = Math.max(...projections);
  const length = maximum - minimum;
  if (!Number.isFinite(length) || length < settings.minimumLength) return null;

  const residual = Math.sqrt(points.reduce((sum, point) => {
    const perpendicular = (point.x - mean.x) * -direction.y + (point.y - mean.y) * direction.x;
    return sum + perpendicular * perpendicular;
  }, 0) / points.length);
  const tolerance = Math.max(settings.maxAbsoluteResidual, boundsDiagonal(points) * settings.maxRelativeResidual);
  const confidence = clamp(1 - residual / Math.max(tolerance, Number.EPSILON));

  return {
    start: { x: mean.x + minimum * direction.x, y: mean.y + minimum * direction.y },
    end: { x: mean.x + maximum * direction.x, y: mean.y + maximum * direction.y },
    residual,
    confidence,
    length,
  };
}
