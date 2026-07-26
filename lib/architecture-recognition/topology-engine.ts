import { clamp, distance } from "@/lib/geometry-recognition/geometry-utils";
import type { ArchitectureCandidate, DoorCandidate, WallCandidate, WindowCandidate } from "@/types/architectural-geometry";
import type { OpeningRelation, ProjectScale, WallConnection, WallGraph, WallNode } from "@/types/architecture-topology";
import type { CadPoint } from "@/types/cad-geometry";
import type { Unit, VectorDocument } from "@/types/vector";

export type ProjectScaleInput = {
  pixelWidth: number;
  pixelHeight: number;
  projectWidth: number;
  projectHeight: number;
  unit: Unit;
};

export type TopologyOptions = {
  scale?: ProjectScale;
  connectionTolerance?: number;
};

const unitToMillimetres: Record<Unit, number> = { px: 1, mm: 1, cm: 10 };

export function createProjectScale(input: ProjectScaleInput): ProjectScale {
  const horizontal = input.pixelWidth / Math.max(input.projectWidth, Number.EPSILON);
  const vertical = input.pixelHeight / Math.max(input.projectHeight, Number.EPSILON);
  return {
    unit: input.unit,
    pixelsPerUnit: (horizontal + vertical) / 2,
    conversionFactor: unitToMillimetres[input.unit],
  };
}

export function pixelsToProjectUnits(value: number, scale: ProjectScale) {
  return value / Math.max(scale.pixelsPerUnit, Number.EPSILON);
}

type Segment = { start: CadPoint; end: CadPoint };

function segmentIntersects(left: Segment, right: Segment, tolerance: number): CadPoint | null {
  const leftDx = left.end.x - left.start.x;
  const leftDy = left.end.y - left.start.y;
  const rightDx = right.end.x - right.start.x;
  const rightDy = right.end.y - right.start.y;
  const denominator = leftDx * rightDy - leftDy * rightDx;
  if (Math.abs(denominator) < Number.EPSILON) return null;
  const offsetX = right.start.x - left.start.x;
  const offsetY = right.start.y - left.start.y;
  const first = (offsetX * rightDy - offsetY * rightDx) / denominator;
  const second = (offsetX * leftDy - offsetY * leftDx) / denominator;
  if (first < -tolerance || first > 1 + tolerance || second < -tolerance || second > 1 + tolerance) return null;
  return { x: left.start.x + first * leftDx, y: left.start.y + first * leftDy };
}

function endpoints(wall: WallCandidate) {
  return [wall.geometry.centerLine.start, wall.geometry.centerLine.end] as const;
}

function sameWalls(left: string, right: string) {
  return [left, right].sort().join(":");
}

/** Builds a connected architectural graph while keeping detection candidates untouched. */
export class ArchitectureTopologyEngine {
  build(candidates: ArchitectureCandidate[], options: TopologyOptions = {}): WallGraph {
    const walls = candidates.filter((candidate): candidate is WallCandidate => candidate.type === "WALL");
    const scale = options.scale || { unit: "px", pixelsPerUnit: 1, conversionFactor: 1 };
    const averageThickness = walls.reduce((total, wall) => total + wall.geometry.thickness, 0) / Math.max(walls.length, 1);
    const tolerance = options.connectionTolerance ?? Math.max(2, averageThickness * .6);
    const nodes: WallNode[] = [];
    const connections: WallConnection[] = [];

    const addNode = (position: CadPoint, wallIds: string[], kind: WallNode["kind"]) => {
      const existing = nodes.find(node => distance(node.position, position) <= tolerance);
      if (existing) {
        for (const wallId of wallIds) if (!existing.wallIds.includes(wallId)) existing.wallIds.push(wallId);
        if (kind === "INTERSECTION") existing.kind = "INTERSECTION";
        else if (kind === "CONTINUITY" && existing.kind === "ENDPOINT") existing.kind = "CONTINUITY";
        return existing;
      }
      const node: WallNode = { id: `wall-node-${nodes.length + 1}`, position: { ...position }, wallIds: [...wallIds], kind };
      nodes.push(node);
      return node;
    };
    const addConnection = (left: WallCandidate, right: WallCandidate, node: WallNode, type: WallConnection["type"], confidence: number) => {
      const key = sameWalls(left.id, right.id);
      if (connections.some(connection => sameWalls(...connection.wallIds) === key && connection.nodeId === node.id)) return;
      connections.push({ id: `wall-connection-${connections.length + 1}`, wallIds: [left.id, right.id], nodeId: node.id, type, confidence: clamp(confidence) });
    };

    for (const wall of walls) for (const endpoint of endpoints(wall)) addNode(endpoint, [wall.id], "ENDPOINT");
    for (let left = 0; left < walls.length; left++) {
      for (let right = left + 1; right < walls.length; right++) {
        const first = walls[left], second = walls[right];
        const intersection = segmentIntersects(first.geometry.centerLine, second.geometry.centerLine, tolerance / Math.max(distance(first.geometry.centerLine.start, first.geometry.centerLine.end), 1));
        if (intersection) {
          const node = addNode(intersection, [first.id, second.id], "INTERSECTION");
          addConnection(first, second, node, "INTERSECTION", Math.min(first.confidence, second.confidence));
          continue;
        }
        for (const firstEnd of endpoints(first)) for (const secondEnd of endpoints(second)) {
          if (distance(firstEnd, secondEnd) > tolerance) continue;
          const position = { x: (firstEnd.x + secondEnd.x) / 2, y: (firstEnd.y + secondEnd.y) / 2 };
          const node = addNode(position, [first.id, second.id], "CONTINUITY");
          addConnection(first, second, node, "CONTINUITY", Math.min(first.confidence, second.confidence));
        }
      }
    }

    const openings = candidates
      .filter((candidate): candidate is DoorCandidate | WindowCandidate => candidate.type === "DOOR" || candidate.type === "WINDOW")
      .map((candidate, index): OpeningRelation => ({
        id: `opening-relation-${index + 1}`,
        openingId: candidate.id,
        openingType: candidate.type,
        hostWallId: candidate.hostWallId,
        position: { ...candidate.position },
        openingDirection: candidate.openingDirection,
        confidence: candidate.confidence,
      }));

    return { id: "wall-graph-1", scale, nodes, connections, openings };
  }
}

export const architectureTopologyEngine = new ArchitectureTopologyEngine();

/** Attaches optional topology without replacing paths, entities or architectural candidates. */
export function createDocumentTopology(document: VectorDocument, scale: ProjectScale, options: Omit<TopologyOptions, "scale"> = {}) {
  const graph = architectureTopologyEngine.build(document.architectureEntities || [], { ...options, scale });
  return { document: { ...document, projectScale: scale, topology: [graph] }, graph };
}
