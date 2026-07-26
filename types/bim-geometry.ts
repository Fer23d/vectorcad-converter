import type { ArchitecturalBounds, ArchitecturalSegment, OpeningDirection } from "@/types/architectural-geometry";
import type { ProjectScale } from "@/types/architecture-topology";
import type { CadPoint } from "@/types/cad-geometry";

export type BimWall = {
  id: string;
  type: "WALL";
  geometry: { centerLine: ArchitecturalSegment; bounds: ArchitecturalBounds };
  thickness: number;
  height: number;
  connections: string[];
  openings: string[];
  confidence: number;
  sourceCandidateId: string;
};

export type BimDoor = {
  id: string;
  type: "DOOR";
  hostWallId: string;
  width: number;
  height: number;
  openingDirection: OpeningDirection;
  position: CadPoint;
  confidence: number;
  sourceCandidateId: string;
};

export type BimWindow = {
  id: string;
  type: "WINDOW";
  hostWallId: string;
  width: number;
  height: number;
  sillHeight: number;
  position: CadPoint;
  confidence: number;
  sourceCandidateId: string;
};

export type BimSpace = {
  id: string;
  type: "SPACE";
  boundary: CadPoint[];
  area: number;
  walls: string[];
  confidence: number;
  sourceCandidateId: string;
};

export type BimElement = BimWall | BimDoor | BimWindow | BimSpace;

export type BimModel = {
  version: "1.0";
  scale: ProjectScale;
  minimumConfidence: number;
  walls: BimWall[];
  doors: BimDoor[];
  windows: BimWindow[];
  spaces: BimSpace[];
  unconfirmedCandidateIds: string[];
};
