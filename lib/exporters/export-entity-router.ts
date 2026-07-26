import { IMAGE_COORDINATE_SYSTEM, coordinateUnitFromDocumentUnit, transformEntity, transformPoint } from "@/lib/geometry/coordinate-transform";
import type { CadEntity, CadPoint } from "@/types/cad-geometry";
import type { CoordinateSystem } from "@/types/coordinate-system";
import type { VectorDocument, VectorPath } from "@/types/vector";

export type RoutedExportGeometry =
  | { kind: "entity"; entity: CadEntity; sourcePathId?: string }
  | { kind: "path"; path: VectorPath; sourcePathId: string; reason: "legacy" | "entity-fallback" };

function finitePoint(point: CadPoint) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function samePoint(a: CadPoint, b: CadPoint) {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

function pathIdentifier(path: VectorPath, index: number) {
  return path.id || `path-${index + 1}`;
}

function sourcePathId(entity: CadEntity) {
  const value = entity.metadata.sourcePathId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function legacyTargetSystem(document: VectorDocument): CoordinateSystem {
  return {
    id: `export-${document.unit}-${document.width}x${document.height}`,
    origin: { x: 0, y: 0 },
    scale: {
      x: document.width / Math.max(document.sourceWidth, Number.EPSILON),
      y: document.height / Math.max(document.sourceHeight, Number.EPSILON),
    },
    rotation: 0,
    unit: coordinateUnitFromDocumentUnit(document.unit),
    precision: 6,
    createdFrom: "manual",
  };
}

/**
 * Documents upgraded by the canonical coordinate-system phase already contain
 * geometry in their target coordinate space. Legacy documents are transformed
 * only at export time, preserving their stored representation.
 */
export function normalizeCadEntityForExport(entity: CadEntity, document: VectorDocument): CadEntity {
  if (document.coordinateSystem) return entity;
  return transformEntity(entity, legacyTargetSystem(document), { from: IMAGE_COORDINATE_SYSTEM });
}

export function normalizePathForExport(path: VectorPath, document: VectorDocument): VectorPath {
  if (document.coordinateSystem) return path;
  const target = legacyTargetSystem(document);
  return {
    ...path,
    points: path.points.map(point => transformPoint(point, target, { from: IMAGE_COORDINATE_SYSTEM })),
  };
}

/** Returns true only when an entity has sufficient data for a native export. */
export function isNativelyExportable(entity: CadEntity): boolean {
  switch (entity.type) {
    case "LINE":
      return finitePoint(entity.coordinates.start) && finitePoint(entity.coordinates.end) && !samePoint(entity.coordinates.start, entity.coordinates.end);
    case "CIRCLE":
      return finitePoint(entity.coordinates.center) && Number.isFinite(entity.coordinates.radius) && entity.coordinates.radius > 0;
    case "ELLIPSE":
      return finitePoint(entity.coordinates.center)
        && Number.isFinite(entity.coordinates.majorRadius) && entity.coordinates.majorRadius > 0
        && Number.isFinite(entity.coordinates.minorRadius) && entity.coordinates.minorRadius > 0
        && Number.isFinite(entity.coordinates.rotation);
    case "ARC":
      return finitePoint(entity.coordinates.center)
        && Number.isFinite(entity.coordinates.radius) && entity.coordinates.radius > 0
        && Number.isFinite(entity.coordinates.startAngle) && Number.isFinite(entity.coordinates.endAngle);
    case "SPLINE":
      return entity.coordinates.fitPoints.filter(finitePoint).length >= 2;
    case "LWPOLYLINE": {
      const points = entity.coordinates.points.filter(finitePoint);
      return points.length >= (entity.coordinates.closed ? 3 : 2);
    }
    case "POLYGON":
      return entity.coordinates.points.filter(finitePoint).length >= 3;
  }
}

function validLegacyPath(path: VectorPath) {
  const points = path.points.filter(finitePoint);
  return points.length >= (path.closed ? 3 : 2);
}

/**
 * Routes each geometry independently. A recognized path is replaced only by
 * its own valid native entity; every unrelated or unsupported path remains in
 * the export, which keeps mixed and legacy documents lossless.
 */
export function routeDocumentGeometry(document: VectorDocument): RoutedExportGeometry[] {
  const pathsById = new Map(document.paths.map((path, index) => [pathIdentifier(path, index), path]));
  const consumedPathIds = new Set<string>();
  const routed: RoutedExportGeometry[] = [];

  for (const sourceEntity of document.entities || []) {
    const entity = normalizeCadEntityForExport(sourceEntity, document);
    const relatedPathId = sourcePathId(sourceEntity);
    const relatedPath = relatedPathId ? pathsById.get(relatedPathId) : undefined;

    if (isNativelyExportable(entity)) {
      routed.push({ kind: "entity", entity, sourcePathId: relatedPathId });
      if (relatedPathId && relatedPath) consumedPathIds.add(relatedPathId);
      continue;
    }

    if (relatedPathId && relatedPath && validLegacyPath(relatedPath) && !consumedPathIds.has(relatedPathId)) {
      routed.push({ kind: "path", path: normalizePathForExport(relatedPath, document), sourcePathId: relatedPathId, reason: "entity-fallback" });
      consumedPathIds.add(relatedPathId);
    }
  }

  document.paths.forEach((path, index) => {
    const id = pathIdentifier(path, index);
    if (!consumedPathIds.has(id) && validLegacyPath(path)) {
      routed.push({ kind: "path", path: normalizePathForExport(path, document), sourcePathId: id, reason: "legacy" });
    }
  });

  return routed;
}

function pointAt(center: CadPoint, radius: number, angle: number): CadPoint {
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

/** Approximate bounds are used only for DXF viewport headers, never geometry export. */
export function routedGeometryBoundsPoints(item: RoutedExportGeometry): CadPoint[] {
  if (item.kind === "path") return item.path.points;
  const { entity } = item;
  switch (entity.type) {
    case "LINE": return [entity.coordinates.start, entity.coordinates.end];
    case "CIRCLE": {
      const { center, radius } = entity.coordinates;
      return [{ x: center.x - radius, y: center.y - radius }, { x: center.x + radius, y: center.y + radius }];
    }
    case "ELLIPSE": {
      const { center, majorRadius, minorRadius, rotation } = entity.coordinates;
      const xExtent = Math.sqrt((majorRadius * Math.cos(rotation)) ** 2 + (minorRadius * Math.sin(rotation)) ** 2);
      const yExtent = Math.sqrt((majorRadius * Math.sin(rotation)) ** 2 + (minorRadius * Math.cos(rotation)) ** 2);
      return [{ x: center.x - xExtent, y: center.y - yExtent }, { x: center.x + xExtent, y: center.y + yExtent }];
    }
    case "ARC": {
      const { center, radius, startAngle, endAngle } = entity.coordinates;
      return Array.from({ length: 17 }, (_, index) => pointAt(center, radius, startAngle + (endAngle - startAngle) * index / 16));
    }
    case "SPLINE": return entity.coordinates.fitPoints;
    case "LWPOLYLINE": return entity.coordinates.points;
    case "POLYGON": return entity.coordinates.points;
  }
}

export const standardCadLayers = ["GEOMETRY", "WALLS", "DOORS", "WINDOWS", "CENTERLINES", "DIMENSIONS"] as const;
