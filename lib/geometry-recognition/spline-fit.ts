import type { CadSplineEntity, CadPoint } from "@/types/cad-geometry";
import { clonePoint } from "@/lib/geometry-recognition/geometry-utils";

/**
 * Preserves unresolved geometry as a fit-point spline contract. It is not wired
 * into the recognition engine until arc and freeform curve policies are enabled.
 */
export function createSplineFallback(id: string, layer: string, points: CadPoint[], closed: boolean, confidence = 0): CadSplineEntity {
  return {
    id,
    type: "SPLINE",
    layer,
    source: "geometry-recognition",
    confidence,
    coordinates: { fitPoints: points.map(clonePoint), degree: 3, closed },
    metadata: { fallback: true },
  };
}
