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

export type ViewerCadEntityResolution = {
  entities: CadEntity[];
  source: ViewerGeometrySource;
  legacyPathCount: number;
  invalidEntityCount: number;
};

function sourcePathKey(path: VectorPath, index: number) {
  return path.id || `path-${index + 1}`;
}

function isFinitePoint(value: unknown): value is { x: number; y: number } {
  return Boolean(
    value
    && typeof value === "object"
    && Number.isFinite((value as { x?: unknown }).x)
    && Number.isFinite((value as { y?: unknown }).y),
  );
}

/** Guards persisted JSON before it is passed to Three.js. */
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
 * Produces a lossless geometry view for the standalone 3D viewer.
 *
 * Recognition is incremental, so a project can contain native CAD entities for
 * only part of its paths. Unlike getCadEntities(), this resolver appends every
 * legacy path that is not explicitly represented by an entity sourcePathId.
 */
export function getViewerGeometry(document: Pick<VectorDocument, "paths" | "entities">): ViewerCadEntityResolution {
  const persistedEntities = document.entities || [];
  const recognized = persistedEntities.filter(isViewerRenderableCadEntity);
  const invalidEntityCount = persistedEntities.length - recognized.length;
  if (!recognized.length) {
    return {
      entities: vectorPathsToCadEntities(document.paths),
      source: "legacy-paths",
      legacyPathCount: document.paths.length,
      invalidEntityCount,
    };
  }

  const representedPathIds = new Set(
    recognized
      .map((entity) => entity.metadata.sourcePathId)
      .filter((value): value is string => typeof value === "string"),
  );
  const remainingPaths = document.paths
    .map((path, index) => ({ path, index }))
    .filter(({ path, index }) => !representedPathIds.has(sourcePathKey(path, index)));
  const legacyEntities = remainingPaths.map(({ path, index }) => vectorPathToCadEntity(path, index));

  return {
    entities: [...recognized, ...legacyEntities],
    source: legacyEntities.length ? "mixed" : "entities",
    legacyPathCount: legacyEntities.length,
    invalidEntityCount,
  };
}

/** @deprecated Use getViewerGeometry() for new 3D-viewer integrations. */
export const getViewerCadEntities = getViewerGeometry;

export function withCadEntities(document: VectorDocument): VectorDocument {
  if (document.entities?.length) return document;
  return { ...document, entities: vectorPathsToCadEntities(document.paths) };
}
