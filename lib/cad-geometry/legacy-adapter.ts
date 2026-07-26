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

export type ViewerGeometrySource = "entities" | "mixed" | "legacy-paths";

export type ViewerGeometryResolution = {
  entities: CadEntity[];
  source: ViewerGeometrySource;
  invalidEntityCount: number;
  legacyPathCount: number;
};

function pathKey(path: VectorPath, index: number) {
  return path.id || `legacy-path-${index + 1}`;
}

function isFinitePoint(value: unknown): value is { x: number; y: number } {
  return Boolean(
    value
    && typeof value === "object"
    && Number.isFinite((value as { x?: unknown }).x)
    && Number.isFinite((value as { y?: unknown }).y),
  );
}

/** Validates persisted JSON before it reaches the Three.js renderer. */
export function isViewerRenderableCadEntity(entity: CadEntity): boolean {
  switch (entity.type) {
    case "LINE":
      return isFinitePoint(entity.coordinates.start) && isFinitePoint(entity.coordinates.end);
    case "CIRCLE":
      return isFinitePoint(entity.coordinates.center) && Number.isFinite(entity.coordinates.radius) && entity.coordinates.radius > 0;
    case "ELLIPSE":
      return isFinitePoint(entity.coordinates.center)
        && Number.isFinite(entity.coordinates.majorRadius) && entity.coordinates.majorRadius > 0
        && Number.isFinite(entity.coordinates.minorRadius) && entity.coordinates.minorRadius > 0
        && Number.isFinite(entity.coordinates.rotation);
    case "ARC":
      return isFinitePoint(entity.coordinates.center)
        && Number.isFinite(entity.coordinates.radius) && entity.coordinates.radius > 0
        && Number.isFinite(entity.coordinates.startAngle) && Number.isFinite(entity.coordinates.endAngle);
    case "SPLINE":
      return entity.coordinates.fitPoints.length >= 2 && entity.coordinates.fitPoints.every(isFinitePoint);
    case "LWPOLYLINE":
      return entity.coordinates.points.length >= (entity.coordinates.closed ? 3 : 2) && entity.coordinates.points.every(isFinitePoint);
    case "POLYGON":
      return entity.coordinates.points.length >= 3 && entity.coordinates.points.every(isFinitePoint);
  }
}

/**
 * Keeps documents with incremental recognition lossless for the 3D viewer.
 * Native entities are preferred, then only the legacy paths they do not cover.
 */
export function getViewerGeometry(document: Pick<VectorDocument, "paths" | "entities">): ViewerGeometryResolution {
  const persistedEntities = document.entities || [];
  const validEntities = persistedEntities.filter(isViewerRenderableCadEntity);
  const invalidEntityCount = persistedEntities.length - validEntities.length;

  if (!validEntities.length) {
    return {
      entities: vectorPathsToCadEntities(document.paths),
      source: "legacy-paths",
      invalidEntityCount,
      legacyPathCount: document.paths.length,
    };
  }

  const representedPathIds = new Set(
    validEntities
      .map((entity) => entity.metadata.sourcePathId)
      .filter((id): id is string => typeof id === "string"),
  );
  const legacyEntities = document.paths
    .map((path, index) => ({ path, index }))
    .filter(({ path, index }) => !representedPathIds.has(pathKey(path, index)))
    .map(({ path, index }) => vectorPathToCadEntity(path, index));

  return {
    entities: [...validEntities, ...legacyEntities],
    source: legacyEntities.length ? "mixed" : "entities",
    invalidEntityCount,
    legacyPathCount: legacyEntities.length,
  };
}

export function withCadEntities(document: VectorDocument): VectorDocument {
  if (document.entities?.length) return document;
  return { ...document, entities: vectorPathsToCadEntities(document.paths) };
}
