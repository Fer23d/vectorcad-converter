import { coordinateUnitFromDocumentUnit } from "@/lib/geometry/coordinate-transform";
import { scaleDocument } from "@/lib/vectorize/contours";
import type { CoordinateSystem } from "@/types/coordinate-system";
import type { Unit, VectorDocument } from "@/types/vector";

export type PreparedThreeViewerDocument = {
  document: VectorDocument;
  hasGeometry: boolean;
  coordinateSystemPreserved: boolean;
};

type ViewerTarget = {
  width?: number;
  height?: number;
  unit?: Unit;
  coordinateSystem?: CoordinateSystem;
};

const EPSILON = 1e-9;

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * EPSILON;
}

function sameCoordinateSystem(left: CoordinateSystem | undefined, right: CoordinateSystem | undefined) {
  if (!left || !right) return left === right;
  return left.unit === right.unit
    && sameNumber(left.origin.x, right.origin.x)
    && sameNumber(left.origin.y, right.origin.y)
    && sameNumber(left.scale.x, right.scale.x)
    && sameNumber(left.scale.y, right.scale.y)
    && sameNumber(left.rotation, right.rotation);
}

/**
 * Normalizes legacy documents only when the caller asks for a different target.
 * A persisted canonical document is passed through untouched so its coordinates
 * are never transformed twice by the standalone viewer.
 */
export function prepareThreeViewerDocument(document: VectorDocument, target: ViewerTarget = {}): PreparedThreeViewerDocument {
  const width = target.width ?? document.width;
  const height = target.height ?? document.height;
  const unit = target.unit ?? document.unit;
  const sameDimensions = sameNumber(document.width, width) && sameNumber(document.height, height) && document.unit === unit;
  const sameSystem = target.coordinateSystem
    ? sameCoordinateSystem(document.coordinateSystem, target.coordinateSystem)
    : Boolean(document.coordinateSystem && document.coordinateSystem.unit === coordinateUnitFromDocumentUnit(unit));
  const coordinateSystemPreserved = sameDimensions && sameSystem;
  const normalized = coordinateSystemPreserved ? document : scaleDocument(document, width, height, unit);

  return {
    document: normalized,
    hasGeometry: Boolean(
      normalized.paths.length
      || normalized.entities?.length
      || normalized.architectureEntities?.length
      || normalized.topology?.length,
    ),
    coordinateSystemPreserved,
  };
}
