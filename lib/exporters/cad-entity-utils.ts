import type { CadCircleEntity, CadEntity, CadLineEntity, CadLwPolylineEntity, CadPoint } from "@/types/cad-geometry";
import type { VectorDocument } from "@/types/vector";

export type ExportableCadEntity = CadLineEntity | CadCircleEntity | CadLwPolylineEntity;

export type CadEntityExportPlan = {
  source: "entities" | "legacy-paths";
  entities: ExportableCadEntity[];
};

function isFinitePoint(point: CadPoint) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function samePoint(a: CadPoint, b: CadPoint) {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

/** Keeps invalid or future-only geometry out of current DXF/SVG exports. */
export function isExportableCadEntity(entity: CadEntity): entity is ExportableCadEntity {
  switch (entity.type) {
    case "LINE":
      return isFinitePoint(entity.coordinates.start)
        && isFinitePoint(entity.coordinates.end)
        && !samePoint(entity.coordinates.start, entity.coordinates.end);
    case "CIRCLE":
      return isFinitePoint(entity.coordinates.center)
        && Number.isFinite(entity.coordinates.radius)
        && entity.coordinates.radius > 0;
    case "LWPOLYLINE": {
      const points = entity.coordinates.points.filter(isFinitePoint);
      const minimum = entity.coordinates.closed ? 3 : 2;
      return points.length >= minimum;
    }
    default:
      return false;
  }
}

function scalePoint(point: CadPoint, scaleX: number, scaleY: number): CadPoint {
  return { x: point.x * scaleX, y: point.y * scaleY };
}

/**
 * Geometry recognition stores coordinates in the source-image space. Exporters
 * receive a document sized in the selected CAD unit, so entities are scaled here
 * just as legacy paths are scaled by scaleDocument.
 */
export function scaleCadEntity(entity: ExportableCadEntity, document: VectorDocument): ExportableCadEntity {
  const scaleX = document.width / Math.max(document.sourceWidth, 1);
  const scaleY = document.height / Math.max(document.sourceHeight, 1);
  const radiusScale = Math.sqrt(Math.abs(scaleX * scaleY));

  switch (entity.type) {
    case "LINE":
      return {
        ...entity,
        coordinates: {
          start: scalePoint(entity.coordinates.start, scaleX, scaleY),
          end: scalePoint(entity.coordinates.end, scaleX, scaleY),
        },
      };
    case "CIRCLE":
      return {
        ...entity,
        coordinates: {
          center: scalePoint(entity.coordinates.center, scaleX, scaleY),
          radius: entity.coordinates.radius * radiusScale,
        },
      };
    case "LWPOLYLINE":
      return {
        ...entity,
        coordinates: {
          ...entity.coordinates,
          points: entity.coordinates.points.map(point => scalePoint(point, scaleX, scaleY)),
        },
      };
  }
}

/**
 * Entity-first export plan with a legacy fallback for projects created before
 * the CAD Geometry Model was introduced.
 */
export function getCadEntityExportPlan(document: VectorDocument): CadEntityExportPlan {
  const entities = (document.entities || [])
    .filter(isExportableCadEntity)
    .map(entity => scaleCadEntity(entity, document));

  return entities.length ? { source: "entities", entities } : { source: "legacy-paths", entities: [] };
}

export function cadEntityBoundsPoints(entity: ExportableCadEntity): CadPoint[] {
  switch (entity.type) {
    case "LINE":
      return [entity.coordinates.start, entity.coordinates.end];
    case "CIRCLE": {
      const { center, radius } = entity.coordinates;
      return [
        { x: center.x - radius, y: center.y - radius },
        { x: center.x + radius, y: center.y + radius },
      ];
    }
    case "LWPOLYLINE":
      return entity.coordinates.points;
  }
}
