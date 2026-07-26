import { getCadEntities } from "@/lib/cad-geometry/legacy-adapter";
import { clamp, distance } from "@/lib/geometry-recognition/geometry-utils";
import type { SkeletonResult } from "@/lib/vectorize/skeleton";
import type { ArchitectureCandidate, ArchitecturalBounds, ArchitecturalSegment, DoorCandidate, OpeningDirection, RoomCandidate, WallCandidate, WindowCandidate } from "@/types/architectural-geometry";
import type { CadEntity, CadLineEntity, CadPoint } from "@/types/cad-geometry";
import type { VectorDocument } from "@/types/vector";

export type ArchitectureRecognitionOptions = {
  skeleton?: SkeletonResult;
  minimumWallThickness?: number;
  maximumWallThickness?: number;
  orthogonalToleranceDegrees?: number;
};

export type ArchitectureRecognitionDiagnostics = {
  walls: number;
  doors: number;
  windows: number;
  rooms: number;
  skeletonPixels: number;
};

type LineCandidate = {
  entity: CadLineEntity;
  segment: ArchitecturalSegment;
  length: number;
  orientation: "horizontal" | "vertical" | null;
};

const radians = (degrees: number) => degrees * Math.PI / 180;

function bounds(points: CadPoint[]): ArchitecturalBounds {
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function segmentBounds(segment: ArchitecturalSegment) {
  return bounds([segment.start, segment.end]);
}

function entityLine(entity: CadEntity, tolerance: number): LineCandidate | null {
  if (entity.type !== "LINE") return null;
  const segment = entity.coordinates;
  const length = distance(segment.start, segment.end);
  if (length <= 0) return null;
  const angle = Math.abs(Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x));
  const horizontal = Math.min(angle, Math.abs(Math.PI - angle)) <= tolerance;
  const vertical = Math.abs(Math.PI / 2 - angle) <= tolerance;
  return { entity, segment, length, orientation: horizontal ? "horizontal" : vertical ? "vertical" : null };
}

function overlapLength(left: LineCandidate, right: LineCandidate) {
  if (left.orientation === "horizontal" && right.orientation === "horizontal") {
    return Math.max(0, Math.min(Math.max(left.segment.start.x, left.segment.end.x), Math.max(right.segment.start.x, right.segment.end.x)) - Math.max(Math.min(left.segment.start.x, left.segment.end.x), Math.min(right.segment.start.x, right.segment.end.x)));
  }
  if (left.orientation === "vertical" && right.orientation === "vertical") {
    return Math.max(0, Math.min(Math.max(left.segment.start.y, left.segment.end.y), Math.max(right.segment.start.y, right.segment.end.y)) - Math.max(Math.min(left.segment.start.y, left.segment.end.y), Math.min(right.segment.start.y, right.segment.end.y)));
  }
  return 0;
}

function wallFromPair(left: LineCandidate, right: LineCandidate, index: number, options: Required<Pick<ArchitectureRecognitionOptions, "minimumWallThickness" | "maximumWallThickness">>): WallCandidate | null {
  if (!left.orientation || left.orientation !== right.orientation) return null;
  const thickness = left.orientation === "horizontal"
    ? Math.abs((left.segment.start.y + left.segment.end.y) / 2 - (right.segment.start.y + right.segment.end.y) / 2)
    : Math.abs((left.segment.start.x + left.segment.end.x) / 2 - (right.segment.start.x + right.segment.end.x) / 2);
  if (thickness < options.minimumWallThickness || thickness > options.maximumWallThickness) return null;
  const overlap = overlapLength(left, right);
  if (overlap < Math.min(left.length, right.length) * .55) return null;

  const leftBounds = segmentBounds(left.segment);
  const rightBounds = segmentBounds(right.segment);
  const centerLine = left.orientation === "horizontal"
    ? {
      start: { x: Math.max(leftBounds.minX, rightBounds.minX), y: (left.segment.start.y + right.segment.start.y) / 2 },
      end: { x: Math.min(leftBounds.maxX, rightBounds.maxX), y: (left.segment.start.y + right.segment.start.y) / 2 },
    }
    : {
      start: { x: (left.segment.start.x + right.segment.start.x) / 2, y: Math.max(leftBounds.minY, rightBounds.minY) },
      end: { x: (left.segment.start.x + right.segment.start.x) / 2, y: Math.min(leftBounds.maxY, rightBounds.maxY) },
    };
  const confidence = clamp(.65 + Math.min(1, overlap / Math.max(left.length, right.length)) * .25 + Math.min(1, Math.min(left.entity.confidence, right.entity.confidence)) * .1);
  return {
    id: `wall-${index + 1}`,
    type: "WALL",
    geometry: { centerLine, boundaries: [left.segment, right.segment], thickness, orientation: left.orientation, bounds: bounds([left.segment.start, left.segment.end, right.segment.start, right.segment.end]) },
    confidence,
    sourceEntities: [left.entity.id, right.entity.id],
  };
}

function pointDistanceToSegment(point: CadPoint, segment: ArchitecturalSegment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const denominator = dx * dx + dy * dy || 1;
  const factor = clamp(((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / denominator);
  return distance(point, { x: segment.start.x + factor * dx, y: segment.start.y + factor * dy });
}

function closestPointOnSegment(point: CadPoint, segment: ArchitecturalSegment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const denominator = dx * dx + dy * dy || 1;
  const factor = clamp(((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / denominator);
  return { x: segment.start.x + factor * dx, y: segment.start.y + factor * dy };
}

function openingDirection(wall: WallCandidate, marker: ArchitecturalSegment): OpeningDirection {
  const midpoint = { x: (marker.start.x + marker.end.x) / 2, y: (marker.start.y + marker.end.y) / 2 };
  const center = wall.geometry.centerLine;
  const normalOffset = wall.geometry.orientation === "horizontal"
    ? midpoint.y - center.start.y
    : midpoint.x - center.start.x;
  return Math.abs(normalOffset) < Number.EPSILON ? "unknown" : normalOffset > 0 ? "positive-normal" : "negative-normal";
}

function openingMarkerForWall(line: LineCandidate, wall: WallCandidate) {
  const perpendicular = wall.geometry.orientation === "horizontal" ? "vertical" : "horizontal";
  if (line.orientation !== perpendicular || wall.sourceEntities.includes(line.entity.id)) return null;
  const minimum = wall.geometry.thickness * .6;
  const maximum = wall.geometry.thickness * 4;
  if (line.length < minimum || line.length > maximum) return null;
  const closeToWall = Math.min(pointDistanceToSegment(line.segment.start, wall.geometry.centerLine), pointDistanceToSegment(line.segment.end, wall.geometry.centerLine));
  return closeToWall <= Math.max(2, wall.geometry.thickness * .8) ? line : null;
}

function windowsFromWalls(lines: LineCandidate[], walls: WallCandidate[]): { windows: WindowCandidate[]; markerIds: Set<string> } {
  const windows: WindowCandidate[] = [];
  const markerIds = new Set<string>();
  for (const wall of walls) {
    const markers = lines.map(line => openingMarkerForWall(line, wall)).filter((line): line is LineCandidate => Boolean(line));
    for (let left = 0; left < markers.length; left++) for (let right = left + 1; right < markers.length; right++) {
      const first = closestPointOnSegment(markers[left].segment.start, wall.geometry.centerLine);
      const second = closestPointOnSegment(markers[right].segment.start, wall.geometry.centerLine);
      const width = distance(first, second);
      if (width < wall.geometry.thickness * .8 || width > wall.geometry.thickness * 8) continue;
      const position = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      windows.push({
        id: `window-${windows.length + 1}`,
        type: "WINDOW",
        geometry: { opening: { start: first, end: second }, bounds: bounds([first, second, markers[left].segment.start, markers[left].segment.end, markers[right].segment.start, markers[right].segment.end]), markers: [markers[left].segment, markers[right].segment] },
        width,
        hostWallId: wall.id,
        position,
        openingDirection: "unknown",
        confidence: clamp(.66 + Math.min(markers[left].entity.confidence, markers[right].entity.confidence) * .24),
        sourceEntities: [...wall.sourceEntities, markers[left].entity.id, markers[right].entity.id],
      });
      markerIds.add(markers[left].entity.id);
      markerIds.add(markers[right].entity.id);
    }
  }
  return { windows, markerIds };
}

function doorsFromWalls(lines: LineCandidate[], walls: WallCandidate[], windowMarkerIds: Set<string>): DoorCandidate[] {
  const doors: DoorCandidate[] = [];
  for (const wall of walls) {
    for (const line of lines) {
      const marker = openingMarkerForWall(line, wall);
      if (!marker || windowMarkerIds.has(line.entity.id)) continue;
      const position = closestPointOnSegment(marker.segment.start, wall.geometry.centerLine);
      doors.push({
        id: `door-${doors.length + 1}`,
        type: "DOOR",
        geometry: { opening: marker.segment, bounds: segmentBounds(marker.segment) },
        width: marker.length,
        hostWallId: wall.id,
        position,
        openingDirection: openingDirection(wall, marker.segment),
        confidence: clamp(.62 + Math.min(1, line.entity.confidence) * .28),
        sourceEntities: [...wall.sourceEntities, marker.entity.id],
      });
    }
  }
  return doors;
}

function polygonArea(points: CadPoint[]) {
  return Math.abs(points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0) / 2);
}

function isOrthogonalLoop(points: CadPoint[], tolerance: number) {
  if (points.length < 4) return false;
  return points.every((point, index) => {
    const next = points[(index + 1) % points.length];
    const angle = Math.abs(Math.atan2(next.y - point.y, next.x - point.x));
    return Math.min(angle, Math.abs(Math.PI - angle), Math.abs(Math.PI / 2 - angle)) <= tolerance;
  });
}

function roomsFromEntities(entities: CadEntity[], tolerance: number): RoomCandidate[] {
  const rooms: RoomCandidate[] = [];
  for (const entity of entities) {
    if (entity.type !== "LWPOLYLINE" || !entity.coordinates.closed || !isOrthogonalLoop(entity.coordinates.points, tolerance)) continue;
    const area = polygonArea(entity.coordinates.points);
    if (area <= 0) continue;
    rooms.push({
      id: `room-${rooms.length + 1}`,
      type: "ROOM",
      geometry: { boundary: entity.coordinates.points.map(point => ({ ...point })), area, bounds: bounds(entity.coordinates.points) },
      confidence: clamp(.7 + Math.min(.25, entity.confidence || .1)),
      sourceEntities: [entity.id],
    });
  }
  return rooms;
}

/** Initial architectural interpretation from normalized CAD entities and an optional centerline mask. */
export class ArchitectureRecognitionEngine {
  recognize(entities: CadEntity[], options: ArchitectureRecognitionOptions = {}) {
    const orthogonalTolerance = radians(options.orthogonalToleranceDegrees ?? 8);
    const linePoints = entities.flatMap(entity => entity.type === "LINE" ? [entity.coordinates.start, entity.coordinates.end] : []);
    const drawingBounds = linePoints.length ? bounds(linePoints) : null;
    const drawingDiagonal = drawingBounds ? Math.hypot(drawingBounds.maxX - drawingBounds.minX, drawingBounds.maxY - drawingBounds.minY) : 0;
    const maximumWallThickness = options.maximumWallThickness ?? Math.max(24, drawingDiagonal * .08);
    const settings = { minimumWallThickness: options.minimumWallThickness ?? 2, maximumWallThickness };
    const lines = entities.map(entity => entityLine(entity, orthogonalTolerance)).filter((line): line is LineCandidate => Boolean(line));
    const walls: WallCandidate[] = [];
    for (let left = 0; left < lines.length; left++) for (let right = left + 1; right < lines.length; right++) {
      const wall = wallFromPair(lines[left], lines[right], walls.length, settings);
      if (wall && !walls.some(existing => existing.sourceEntities.join(",") === wall.sourceEntities.join(","))) walls.push(wall);
    }
    const { windows, markerIds } = windowsFromWalls(lines, walls);
    const doors = doorsFromWalls(lines, walls, markerIds);
    const rooms = roomsFromEntities(entities, orthogonalTolerance);
    const skeletonPixels = options.skeleton?.data.reduce((count, value) => count + (value ? 1 : 0), 0) || 0;
    const candidates: ArchitectureCandidate[] = [...walls, ...doors, ...windows, ...rooms];
    return { candidates, diagnostics: { walls: walls.length, doors: doors.length, windows: windows.length, rooms: rooms.length, skeletonPixels } satisfies ArchitectureRecognitionDiagnostics };
  }
}

export const architectureRecognitionEngine = new ArchitectureRecognitionEngine();

/** Preserves paths and CAD entities while attaching optional architectural candidates. */
export function recognizeDocumentArchitecture(document: VectorDocument, options: ArchitectureRecognitionOptions = {}) {
  const result = architectureRecognitionEngine.recognize(getCadEntities(document), options);
  return { document: { ...document, architectureEntities: result.candidates }, diagnostics: result.diagnostics };
}
