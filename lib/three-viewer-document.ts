import { scaleDocument } from "@/lib/vectorize/contours";
import { coordinateUnitFromDocumentUnit } from "@/lib/geometry/coordinate-transform";
import type { Unit, VectorDocument } from "@/types/vector";

export type PreparedThreeViewerDocument = {
  document: VectorDocument;
  hasGeometry: boolean;
  coordinateSystemPreserved: boolean;
};

const EPSILON = 1e-9;

function matchesTarget(value: number, target: number) {
  return Math.abs(value - target) <= Math.max(1, Math.abs(value), Math.abs(target)) * EPSILON;
}

/**
 * A persisted document that already declares the requested dimensions and unit
 * is already expressed in its canonical coordinate system. Reapplying
 * scaleDocument in that case can overwrite imported/manual calibration.
 */
export function hasTargetCoordinateSystem(document: VectorDocument, width: number, height: number, unit: Unit) {
  return Boolean(
    document.coordinateSystem
    && document.coordinateSystem.unit === coordinateUnitFromDocumentUnit(unit)
    && document.unit === unit
    && matchesTarget(document.width, width)
    && matchesTarget(document.height, height),
  );
}

/**
 * Normalizes both legacy path documents and rich CAD documents before the 3D
 * viewer consumes them. scaleDocument is idempotent for documents that already
 * carry the canonical CoordinateSystem.
 */
export function prepareThreeViewerDocument(document: VectorDocument, width?: number, height?: number, unit?: Unit): PreparedThreeViewerDocument {
  const targetWidth = width || document.width;
  const targetHeight = height || document.height;
  const targetUnit = unit || document.unit;
  const coordinateSystemPreserved = hasTargetCoordinateSystem(document, targetWidth, targetHeight, targetUnit);
  const normalized = coordinateSystemPreserved
    ? document
    : scaleDocument(document, targetWidth, targetHeight, targetUnit);
  return {
    document: normalized,
    hasGeometry: Boolean(
      normalized.entities?.length
      || normalized.paths.length
      || normalized.architectureEntities?.length
      || normalized.topology?.length,
    ),
    coordinateSystemPreserved,
  };
}
