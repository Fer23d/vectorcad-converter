import type { CadPoint } from "@/types/cad-geometry";
import { fitCircle, type CircleFitOptions } from "@/lib/geometry-recognition/circle-fit";
import { normalizeAngle } from "@/lib/geometry-recognition/geometry-utils";

export type ArcFitResult = {
  center: CadPoint;
  radius: number;
  startAngle: number;
  endAngle: number;
  residual: number;
  confidence: number;
};

/** Reserved for the next phase; provides a shared circle-based contract for arc fitting. */
export function fitArc(points: CadPoint[], options: CircleFitOptions = {}): ArcFitResult | null {
  if (points.length < 3) return null;
  const circle = fitCircle(points, { ...options, minimumPoints: Math.min(options.minimumPoints || 8, points.length), minimumCoverageRatio: 0 });
  if (!circle) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return {
    center: circle.center,
    radius: circle.radius,
    startAngle: normalizeAngle(Math.atan2(first.y - circle.center.y, first.x - circle.center.x)),
    endAngle: normalizeAngle(Math.atan2(last.y - circle.center.y, last.x - circle.center.x)),
    residual: circle.residual,
    confidence: circle.confidence,
  };
}
