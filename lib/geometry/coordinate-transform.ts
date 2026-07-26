import type { ArchitectureCandidate, ArchitecturalBounds, ArchitecturalSegment, DoorCandidate, RoomCandidate, WallCandidate, WindowCandidate } from "@/types/architectural-geometry";
import type { OpeningRelation, ProjectScale, WallGraph, WallNode } from "@/types/architecture-topology";
import type { BimDoor, BimModel, BimSpace, BimWall, BimWindow } from "@/types/bim-geometry";
import type { CadArcEntity, CadCircleEntity, CadEllipseEntity, CadEntity, CadPoint } from "@/types/cad-geometry";
import type { CoordinateSystem, CoordinateUnit } from "@/types/coordinate-system";

type TransformOptions = { from?: CoordinateSystem };

export const IMAGE_COORDINATE_SYSTEM: CoordinateSystem = {
  id: "image-pixels-v1",
  origin: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
  rotation: 0,
  unit: "pixel",
  precision: 6,
  createdFrom: "image",
};

export function coordinateUnitFromDocumentUnit(unit: "px" | "mm" | "cm"): CoordinateUnit {
  return unit === "px" ? "pixel" : unit === "mm" ? "millimeter" : "centimeter";
}

export function documentUnitFromCoordinateUnit(unit: CoordinateUnit): "px" | "mm" | "cm" | "m" {
  return unit === "pixel" ? "px" : unit === "millimeter" ? "mm" : unit === "centimeter" ? "cm" : "m";
}

/**
 * Converts a pixel distance only through an explicit calibrated coordinate
 * system. A missing or pixel-only system deliberately keeps the input value.
 */
export function pixelsToCoordinateUnits(value: number, system: CoordinateSystem, axis: "x" | "y" = "x") {
  if (system.unit === "pixel") return value;
  return value * Math.abs(system.scale[axis]);
}

function roundingPrecision(system: CoordinateSystem) {
  return Math.max(0, Math.min(12, Math.floor(system.precision)));
}

function round(value: number, precision: number) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function applyTransform(point: CadPoint, system: CoordinateSystem): CadPoint {
  const scaledX = point.x * system.scale.x;
  const scaledY = point.y * system.scale.y;
  const cos = Math.cos(system.rotation);
  const sin = Math.sin(system.rotation);
  const precision = roundingPrecision(system);
  return {
    x: round(system.origin.x + scaledX * cos - scaledY * sin, precision),
    y: round(system.origin.y + scaledX * sin + scaledY * cos, precision),
  };
}

function inverseTransform(point: CadPoint, system: CoordinateSystem): CadPoint {
  const translatedX = point.x - system.origin.x;
  const translatedY = point.y - system.origin.y;
  const cos = Math.cos(system.rotation);
  const sin = Math.sin(system.rotation);
  return {
    x: (translatedX * cos + translatedY * sin) / Math.max(Math.abs(system.scale.x), Number.EPSILON) * Math.sign(system.scale.x || 1),
    y: (-translatedX * sin + translatedY * cos) / Math.max(Math.abs(system.scale.y), Number.EPSILON) * Math.sign(system.scale.y || 1),
  };
}

/** Transforms a point from an optional source coordinate system into a target system. */
export function transformPoint(point: CadPoint, system: CoordinateSystem, options: TransformOptions = {}): CadPoint {
  return applyTransform(options.from ? inverseTransform(point, options.from) : point, system);
}

function transformVector(vector: CadPoint, system: CoordinateSystem, options: TransformOptions = {}): CadPoint {
  const origin = transformPoint({ x: 0, y: 0 }, system, options);
  const endpoint = transformPoint(vector, system, options);
  return { x: endpoint.x - origin.x, y: endpoint.y - origin.y };
}

function vectorLength(vector: CadPoint) {
  return Math.hypot(vector.x, vector.y);
}

function transformedDistance(start: CadPoint, end: CadPoint, system: CoordinateSystem, options: TransformOptions) {
  const first = transformPoint(start, system, options);
  const second = transformPoint(end, system, options);
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function isUniformTransform(system: CoordinateSystem, options: TransformOptions) {
  const xAxis = vectorLength(transformVector({ x: 1, y: 0 }, system, options));
  const yAxis = vectorLength(transformVector({ x: 0, y: 1 }, system, options));
  return Math.abs(xAxis - yAxis) <= Math.max(xAxis, yAxis, 1) * 1e-9;
}

function transformedBounds(bounds: ArchitecturalBounds, system: CoordinateSystem, options: TransformOptions): ArchitecturalBounds {
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ].map(point => transformPoint(point, system, options));
  return {
    minX: Math.min(...corners.map(point => point.x)),
    minY: Math.min(...corners.map(point => point.y)),
    maxX: Math.max(...corners.map(point => point.x)),
    maxY: Math.max(...corners.map(point => point.y)),
  };
}

function transformSegment(segment: ArchitecturalSegment, system: CoordinateSystem, options: TransformOptions): ArchitecturalSegment {
  return { start: transformPoint(segment.start, system, options), end: transformPoint(segment.end, system, options) };
}

function orientationFromSegment(segment: ArchitecturalSegment): "horizontal" | "vertical" {
  return Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y) ? "horizontal" : "vertical";
}

function transformEllipse(entity: CadEllipseEntity, system: CoordinateSystem, options: TransformOptions): CadEllipseEntity {
  const angle = entity.coordinates.rotation;
  const majorVector = transformVector({ x: Math.cos(angle) * entity.coordinates.majorRadius, y: Math.sin(angle) * entity.coordinates.majorRadius }, system, options);
  const minorVector = transformVector({ x: -Math.sin(angle) * entity.coordinates.minorRadius, y: Math.cos(angle) * entity.coordinates.minorRadius }, system, options);
  return {
    ...entity,
    coordinates: {
      center: transformPoint(entity.coordinates.center, system, options),
      majorRadius: vectorLength(majorVector),
      minorRadius: vectorLength(minorVector),
      rotation: Math.atan2(majorVector.y, majorVector.x),
    },
  };
}

function transformedCircle(entity: CadCircleEntity, system: CoordinateSystem, options: TransformOptions): CadCircleEntity | CadEllipseEntity {
  const xRadius = vectorLength(transformVector({ x: entity.coordinates.radius, y: 0 }, system, options));
  const yRadius = vectorLength(transformVector({ x: 0, y: entity.coordinates.radius }, system, options));
  const center = transformPoint(entity.coordinates.center, system, options);
  if (isUniformTransform(system, options)) return { ...entity, coordinates: { center, radius: xRadius } };
  const majorIsX = xRadius >= yRadius;
  return {
    ...entity,
    type: "ELLIPSE",
    coordinates: {
      center,
      majorRadius: majorIsX ? xRadius : yRadius,
      minorRadius: majorIsX ? yRadius : xRadius,
      rotation: majorIsX ? Math.atan2(transformVector({ x: 1, y: 0 }, system, options).y, transformVector({ x: 1, y: 0 }, system, options).x) : Math.atan2(transformVector({ x: 0, y: 1 }, system, options).y, transformVector({ x: 0, y: 1 }, system, options).x),
    },
    metadata: { ...entity.metadata, originalEntityType: "CIRCLE", deformedByNonUniformScale: true },
  };
}

function sampleArc(entity: CadArcEntity, samples = 16) {
  const span = entity.coordinates.endAngle - entity.coordinates.startAngle;
  return Array.from({ length: samples + 1 }, (_, index) => {
    const angle = entity.coordinates.startAngle + span * index / samples;
    return { x: entity.coordinates.center.x + Math.cos(angle) * entity.coordinates.radius, y: entity.coordinates.center.y + Math.sin(angle) * entity.coordinates.radius };
  });
}

/** Transforms every current CAD entity without fabricating circular geometry after anisotropic scaling. */
export function transformEntity(entity: CadEntity, system: CoordinateSystem, options: TransformOptions = {}): CadEntity {
  switch (entity.type) {
    case "LINE":
      return { ...entity, coordinates: { start: transformPoint(entity.coordinates.start, system, options), end: transformPoint(entity.coordinates.end, system, options) } };
    case "CIRCLE":
      return transformedCircle(entity, system, options);
    case "ELLIPSE":
      return transformEllipse(entity, system, options);
    case "ARC": {
      if (isUniformTransform(system, options)) {
        const center = transformPoint(entity.coordinates.center, system, options);
        const radius = vectorLength(transformVector({ x: entity.coordinates.radius, y: 0 }, system, options));
        const rotation = Math.atan2(transformVector({ x: 1, y: 0 }, system, options).y, transformVector({ x: 1, y: 0 }, system, options).x);
        return { ...entity, coordinates: { center, radius, startAngle: entity.coordinates.startAngle + rotation, endAngle: entity.coordinates.endAngle + rotation } };
      }
      return {
        ...entity,
        type: "SPLINE",
        coordinates: { fitPoints: sampleArc(entity).map(point => transformPoint(point, system, options)), degree: 3, closed: false },
        metadata: { ...entity.metadata, originalEntityType: "ARC", deformedByNonUniformScale: true },
      };
    }
    case "SPLINE":
      return {
        ...entity,
        coordinates: {
          ...entity.coordinates,
          fitPoints: entity.coordinates.fitPoints.map(point => transformPoint(point, system, options)),
          controlPoints: entity.coordinates.controlPoints?.map(point => transformPoint(point, system, options)),
        },
      };
    case "LWPOLYLINE":
      return { ...entity, coordinates: { ...entity.coordinates, points: entity.coordinates.points.map(point => transformPoint(point, system, options)) } };
    case "POLYGON":
      return { ...entity, coordinates: { ...entity.coordinates, points: entity.coordinates.points.map(point => transformPoint(point, system, options)) } };
  }
}

export function transformArchitectureEntity(candidate: ArchitectureCandidate, system: CoordinateSystem, options: TransformOptions = {}): ArchitectureCandidate {
  switch (candidate.type) {
    case "WALL": {
      const centerLine = transformSegment(candidate.geometry.centerLine, system, options);
      const boundaries: [ArchitecturalSegment, ArchitecturalSegment] = [transformSegment(candidate.geometry.boundaries[0], system, options), transformSegment(candidate.geometry.boundaries[1], system, options)];
      const normal = candidate.geometry.orientation === "horizontal" ? { x: 0, y: candidate.geometry.thickness } : { x: candidate.geometry.thickness, y: 0 };
      return {
        ...candidate,
        geometry: {
          ...candidate.geometry,
          centerLine,
          boundaries,
          thickness: vectorLength(transformVector(normal, system, options)),
          orientation: orientationFromSegment(centerLine),
          bounds: transformedBounds(candidate.geometry.bounds, system, options),
        },
      } satisfies WallCandidate;
    }
    case "DOOR": {
      const opening = transformSegment(candidate.geometry.opening, system, options);
      return { ...candidate, width: transformedDistance(candidate.geometry.opening.start, candidate.geometry.opening.end, system, options), position: transformPoint(candidate.position, system, options), geometry: { ...candidate.geometry, opening, bounds: transformedBounds(candidate.geometry.bounds, system, options) } } satisfies DoorCandidate;
    }
    case "WINDOW": {
      const opening = transformSegment(candidate.geometry.opening, system, options);
      return { ...candidate, width: transformedDistance(candidate.geometry.opening.start, candidate.geometry.opening.end, system, options), position: transformPoint(candidate.position, system, options), geometry: { ...candidate.geometry, opening, markers: [transformSegment(candidate.geometry.markers[0], system, options), transformSegment(candidate.geometry.markers[1], system, options)], bounds: transformedBounds(candidate.geometry.bounds, system, options) } } satisfies WindowCandidate;
    }
    case "ROOM": {
      const areaFactor = Math.abs(
        transformVector({ x: 1, y: 0 }, system, options).x * transformVector({ x: 0, y: 1 }, system, options).y -
        transformVector({ x: 1, y: 0 }, system, options).y * transformVector({ x: 0, y: 1 }, system, options).x,
      );
      return { ...candidate, geometry: { ...candidate.geometry, boundary: candidate.geometry.boundary.map(point => transformPoint(point, system, options)), area: candidate.geometry.area * areaFactor, bounds: transformedBounds(candidate.geometry.bounds, system, options) } } satisfies RoomCandidate;
    }
  }
}

function projectScaleUnit(unit: CoordinateUnit): ProjectScale["unit"] {
  return documentUnitFromCoordinateUnit(unit);
}

function unitToMillimetres(unit: CoordinateUnit) {
  return unit === "meter" ? 1000 : unit === "centimeter" ? 10 : 1;
}

export function transformProjectScale(scale: ProjectScale, system: CoordinateSystem, options: TransformOptions = {}) {
  const xAxis = vectorLength(transformVector({ x: 1, y: 0 }, system, options));
  const yAxis = vectorLength(transformVector({ x: 0, y: 1 }, system, options));
  return { ...scale, unit: projectScaleUnit(system.unit), pixelsPerUnit: scale.pixelsPerUnit * (xAxis + yAxis) / 2, conversionFactor: unitToMillimetres(system.unit) };
}

/** Transforms graph nodes and opening relations together with their calibrated scale. */
export function transformTopology(graph: WallGraph, system: CoordinateSystem, options: TransformOptions = {}): WallGraph {
  const transformNode = (node: WallNode): WallNode => ({ ...node, position: transformPoint(node.position, system, options), wallIds: [...node.wallIds] });
  const transformOpening = (opening: OpeningRelation): OpeningRelation => ({ ...opening, position: transformPoint(opening.position, system, options) });
  return { ...graph, scale: transformProjectScale(graph.scale, system, options), nodes: graph.nodes.map(transformNode), connections: graph.connections.map(connection => ({ ...connection, wallIds: [...connection.wallIds] as [string, string] })), openings: graph.openings.map(transformOpening) };
}

function transformBimWall(wall: BimWall, system: CoordinateSystem, options: TransformOptions): BimWall {
  const centerLine = transformSegment(wall.geometry.centerLine, system, options);
  const normal = orientationFromSegment(wall.geometry.centerLine) === "horizontal" ? { x: 0, y: wall.thickness } : { x: wall.thickness, y: 0 };
  return { ...wall, geometry: { centerLine, bounds: transformedBounds(wall.geometry.bounds, system, options) }, thickness: vectorLength(transformVector(normal, system, options)), connections: [...wall.connections], openings: [...wall.openings] };
}

/** Transforms the BIM projection without changing IDs or wall-opening relationships. */
export function transformBimModel(model: BimModel, system: CoordinateSystem, options: TransformOptions = {}): BimModel {
  const areaFactor = Math.abs(
    transformVector({ x: 1, y: 0 }, system, options).x * transformVector({ x: 0, y: 1 }, system, options).y -
    transformVector({ x: 1, y: 0 }, system, options).y * transformVector({ x: 0, y: 1 }, system, options).x,
  );
  const widthScale = (vectorLength(transformVector({ x: 1, y: 0 }, system, options)) + vectorLength(transformVector({ x: 0, y: 1 }, system, options))) / 2;
  const door = (item: BimDoor): BimDoor => ({ ...item, width: item.width * widthScale, position: transformPoint(item.position, system, options) });
  const window = (item: BimWindow): BimWindow => ({ ...item, width: item.width * widthScale, position: transformPoint(item.position, system, options) });
  const space = (item: BimSpace): BimSpace => ({ ...item, boundary: item.boundary.map(point => transformPoint(point, system, options)), area: item.area * areaFactor, walls: [...item.walls] });
  return { ...model, scale: transformProjectScale(model.scale, system, options), walls: model.walls.map(wall => transformBimWall(wall, system, options)), doors: model.doors.map(door), windows: model.windows.map(window), spaces: model.spaces.map(space), unconfirmedCandidateIds: [...model.unconfirmedCandidateIds] };
}
