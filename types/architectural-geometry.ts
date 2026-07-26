import type { CadPoint } from "@/types/cad-geometry";

export type ArchitecturalBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type ArchitecturalSegment = {
  start: CadPoint;
  end: CadPoint;
};

export type OpeningDirection = "positive-normal" | "negative-normal" | "unknown";

type ArchitecturalCandidateBase<Type extends string, Geometry> = {
  id: string;
  type: Type;
  geometry: Geometry;
  confidence: number;
  sourceEntities: string[];
};

export type WallCandidate = ArchitecturalCandidateBase<"WALL", {
  centerLine: ArchitecturalSegment;
  boundaries: [ArchitecturalSegment, ArchitecturalSegment];
  thickness: number;
  orientation: "horizontal" | "vertical";
  bounds: ArchitecturalBounds;
}>;

export type DoorCandidate = ArchitecturalCandidateBase<"DOOR", {
  opening: ArchitecturalSegment;
  bounds: ArchitecturalBounds;
}> & {
  width: number;
  hostWallId: string;
  position: CadPoint;
  openingDirection: OpeningDirection;
};

export type WindowCandidate = ArchitecturalCandidateBase<"WINDOW", {
  opening: ArchitecturalSegment;
  bounds: ArchitecturalBounds;
  markers: [ArchitecturalSegment, ArchitecturalSegment];
}> & {
  width: number;
  hostWallId: string;
  position: CadPoint;
  openingDirection: OpeningDirection;
};

export type RoomCandidate = ArchitecturalCandidateBase<"ROOM", {
  boundary: CadPoint[];
  area: number;
  bounds: ArchitecturalBounds;
}>;

export type ArchitectureCandidate = WallCandidate | DoorCandidate | WindowCandidate | RoomCandidate;
