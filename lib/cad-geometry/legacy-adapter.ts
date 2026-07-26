import type { CadEntity, CadLwPolylineEntity } from "@/types/cad-geometry";
import type { VectorDocument, VectorPath } from "@/types/vector";

/**
 * Preserves legacy paths exactly as editable CAD polylines. Geometry fitting is
 * intentionally deferred to the recognition engine introduced in the next phase.
 */
export function vectorPathToCadEntity(path: VectorPath, index = 0): CadLwPolylineEntity {
  return {
    id: `legacy-path-${index + 1}`,
    type: "LWPOLYLINE",
    layer: path.layer,
    source: "legacy-vector-path",
    confidence: 1,
    coordinates: {
      points: path.points.map((point) => ({ x: point.x, y: point.y })),
      closed: path.closed,
    },
    metadata: {
      legacyPathIndex: index,
      curved: Boolean(path.curved),
    },
  };
}

export function vectorPathsToCadEntities(paths: VectorPath[]): CadEntity[] {
  return paths.map(vectorPathToCadEntity);
}

/**
 * Provides a normalized geometry view without requiring a database migration.
 * Existing projects continue to use paths; new consumers can read entities.
 */
export function getCadEntities(document: Pick<VectorDocument, "paths" | "entities">): CadEntity[] {
  return document.entities?.length ? document.entities : vectorPathsToCadEntities(document.paths);
}

export function withCadEntities(document: VectorDocument): VectorDocument {
  if (document.entities?.length) return document;
  return { ...document, entities: vectorPathsToCadEntities(document.paths) };
}
