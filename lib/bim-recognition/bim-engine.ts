import { distance } from "@/lib/geometry-recognition/geometry-utils";
import type { ArchitectureCandidate, ArchitecturalBounds, ArchitecturalSegment, DoorCandidate, RoomCandidate, WallCandidate, WindowCandidate } from "@/types/architectural-geometry";
import type { ProjectScale, WallGraph } from "@/types/architecture-topology";
import type { BimDoor, BimModel, BimSpace, BimWall, BimWindow } from "@/types/bim-geometry";
import type { CadPoint } from "@/types/cad-geometry";
import type { VectorDocument } from "@/types/vector";

export type BimRecognitionOptions = {
  minimumConfidence?: number;
  defaultWallHeightMm?: number;
  defaultDoorHeightMm?: number;
  defaultWindowHeightMm?: number;
  defaultSillHeightMm?: number;
};

const defaults: Required<BimRecognitionOptions> = {
  minimumConfidence: .75,
  defaultWallHeightMm: 2800,
  defaultDoorHeightMm: 2100,
  defaultWindowHeightMm: 1200,
  defaultSillHeightMm: 900,
};

function fallbackScale(document: VectorDocument): ProjectScale {
  return document.projectScale || { unit: document.unit, pixelsPerUnit: 1, conversionFactor: document.unit === "cm" ? 10 : 1 };
}

function millimetresToProjectUnits(value: number, scale: ProjectScale) {
  return value / Math.max(scale.conversionFactor, Number.EPSILON);
}

function scalePoint(point: CadPoint, scale: ProjectScale): CadPoint {
  return { x: point.x / Math.max(scale.pixelsPerUnit, Number.EPSILON), y: point.y / Math.max(scale.pixelsPerUnit, Number.EPSILON) };
}

function scaleSegment(segment: ArchitecturalSegment, scale: ProjectScale): ArchitecturalSegment {
  return { start: scalePoint(segment.start, scale), end: scalePoint(segment.end, scale) };
}

function scaleBounds(bounds: ArchitecturalBounds, scale: ProjectScale): ArchitecturalBounds {
  return {
    minX: bounds.minX / Math.max(scale.pixelsPerUnit, Number.EPSILON),
    minY: bounds.minY / Math.max(scale.pixelsPerUnit, Number.EPSILON),
    maxX: bounds.maxX / Math.max(scale.pixelsPerUnit, Number.EPSILON),
    maxY: bounds.maxY / Math.max(scale.pixelsPerUnit, Number.EPSILON),
  };
}

function distanceToSegment(point: CadPoint, segment: ArchitecturalSegment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const denominator = dx * dx + dy * dy || 1;
  const factor = Math.max(0, Math.min(1, ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / denominator));
  return distance(point, { x: segment.start.x + factor * dx, y: segment.start.y + factor * dy });
}

function linkedWallsForRoom(room: RoomCandidate, walls: Array<{ candidate: WallCandidate; bim: BimWall }>) {
  return walls
    .filter(({ candidate }) => room.geometry.boundary.some(point => distanceToSegment(point, candidate.geometry.centerLine) <= candidate.geometry.thickness))
    .map(({ bim }) => bim.id);
}

function candidateIds(candidates: ArchitectureCandidate[], minimumConfidence: number, wallIds: Set<string>) {
  return candidates
    .filter(candidate => candidate.confidence < minimumConfidence || ((candidate.type === "DOOR" || candidate.type === "WINDOW") && !wallIds.has(candidate.hostWallId)))
    .map(candidate => candidate.id);
}

/** Promotes only high-confidence architectural candidates into a unit-aware BIM core. */
export class BimRecognitionEngine {
  build(document: VectorDocument, options: BimRecognitionOptions = {}): BimModel {
    const settings = { ...defaults, ...options };
    const scale = fallbackScale(document);
    const candidates = document.architectureEntities || [];
    const graph: WallGraph | undefined = document.topology?.[0];
    const wallCandidates = candidates.filter((candidate): candidate is WallCandidate => candidate.type === "WALL" && candidate.confidence >= settings.minimumConfidence);
    const wallMap = new Map<string, BimWall>();
    const walls = wallCandidates.map((candidate): BimWall => {
      const id = `bim-${candidate.id}`;
      const bim: BimWall = {
        id,
        type: "WALL",
        geometry: { centerLine: scaleSegment(candidate.geometry.centerLine, scale), bounds: scaleBounds(candidate.geometry.bounds, scale) },
        thickness: candidate.geometry.thickness / Math.max(scale.pixelsPerUnit, Number.EPSILON),
        height: millimetresToProjectUnits(settings.defaultWallHeightMm, scale),
        connections: [],
        openings: [],
        confidence: candidate.confidence,
        sourceCandidateId: candidate.id,
      };
      wallMap.set(candidate.id, bim);
      return bim;
    });
    for (const wall of walls) {
      const connectedCandidateIds = (graph?.connections || [])
        .filter(connection => connection.wallIds.includes(wall.sourceCandidateId))
        .map(connection => connection.wallIds.find(wallId => wallId !== wall.sourceCandidateId))
        .filter((wallId): wallId is string => typeof wallId === "string")
        .filter(wallId => wallMap.has(wallId));
      wall.connections = [...new Set(connectedCandidateIds.map(wallId => wallMap.get(wallId)!.id))];
    }

    const doors = candidates
      .filter((candidate): candidate is DoorCandidate => candidate.type === "DOOR" && candidate.confidence >= settings.minimumConfidence && wallMap.has(candidate.hostWallId))
      .map((candidate): BimDoor => ({
        id: `bim-${candidate.id}`,
        type: "DOOR",
        hostWallId: wallMap.get(candidate.hostWallId)!.id,
        width: candidate.width / Math.max(scale.pixelsPerUnit, Number.EPSILON),
        height: millimetresToProjectUnits(settings.defaultDoorHeightMm, scale),
        openingDirection: candidate.openingDirection,
        position: scalePoint(candidate.position, scale),
        confidence: candidate.confidence,
        sourceCandidateId: candidate.id,
      }));
    const windows = candidates
      .filter((candidate): candidate is WindowCandidate => candidate.type === "WINDOW" && candidate.confidence >= settings.minimumConfidence && wallMap.has(candidate.hostWallId))
      .map((candidate): BimWindow => ({
        id: `bim-${candidate.id}`,
        type: "WINDOW",
        hostWallId: wallMap.get(candidate.hostWallId)!.id,
        width: candidate.width / Math.max(scale.pixelsPerUnit, Number.EPSILON),
        height: millimetresToProjectUnits(settings.defaultWindowHeightMm, scale),
        sillHeight: millimetresToProjectUnits(settings.defaultSillHeightMm, scale),
        position: scalePoint(candidate.position, scale),
        confidence: candidate.confidence,
        sourceCandidateId: candidate.id,
      }));
    for (const opening of [...doors, ...windows]) {
      const wall = walls.find(candidate => candidate.id === opening.hostWallId);
      if (wall) wall.openings.push(opening.id);
    }

    const spaces = candidates
      .filter((candidate): candidate is RoomCandidate => candidate.type === "ROOM" && candidate.confidence >= settings.minimumConfidence)
      .map((candidate): BimSpace => ({
        id: `bim-${candidate.id}`,
        type: "SPACE",
        boundary: candidate.geometry.boundary.map(point => scalePoint(point, scale)),
        area: candidate.geometry.area / Math.max(scale.pixelsPerUnit * scale.pixelsPerUnit, Number.EPSILON),
        walls: linkedWallsForRoom(candidate, wallCandidates.map(wall => ({ candidate: wall, bim: wallMap.get(wall.id)! }))),
        confidence: candidate.confidence,
        sourceCandidateId: candidate.id,
      }));

    return {
      version: "1.0",
      scale,
      minimumConfidence: settings.minimumConfidence,
      walls,
      doors,
      windows,
      spaces,
      unconfirmedCandidateIds: candidateIds(candidates, settings.minimumConfidence, new Set(wallMap.keys())),
    };
  }
}

export const bimRecognitionEngine = new BimRecognitionEngine();

/** Attaches a BIM projection without changing the legacy vector or architecture layers. */
export function createDocumentBimModel(document: VectorDocument, options: BimRecognitionOptions = {}) {
  const bimModel = bimRecognitionEngine.build(document, options);
  return { document: { ...document, bimModel }, bimModel };
}
