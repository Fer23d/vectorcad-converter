import { scaleDocument } from "@/lib/vectorize/contours";
import type { Unit, VectorDocument } from "@/types/vector";

export type PreparedThreeViewerDocument = {
  document: VectorDocument;
  hasGeometry: boolean;
};

/**
 * Normalizes both legacy path documents and rich CAD documents before the 3D
 * viewer consumes them. scaleDocument is idempotent for documents that already
 * carry the canonical CoordinateSystem.
 */
export function prepareThreeViewerDocument(document: VectorDocument, width?: number, height?: number, unit?: Unit): PreparedThreeViewerDocument {
  const targetWidth = width || document.width;
  const targetHeight = height || document.height;
  const targetUnit = unit || document.unit;
  const normalized = scaleDocument(document, targetWidth, targetHeight, targetUnit);
  return {
    document: normalized,
    hasGeometry: Boolean(normalized.entities?.length || normalized.paths.length),
  };
}
