import type { CadPoint } from "@/types/cad-geometry";
import type { Unit } from "@/types/vector";

export type ProjectScale = {
  unit: Unit | "m";
  pixelsPerUnit: number;
  /** Multiplier from the configured project unit to millimetres. */
  conversionFactor: number;
};

export type WallNode = {
  id: string;
  position: CadPoint;
  wallIds: string[];
  kind: "ENDPOINT" | "CONTINUITY" | "INTERSECTION";
};

export type WallConnection = {
  id: string;
  wallIds: [string, string];
  nodeId: string;
  type: "ENDPOINT" | "CONTINUITY" | "INTERSECTION";
  confidence: number;
};

export type OpeningRelation = {
  id: string;
  openingId: string;
  openingType: "DOOR" | "WINDOW";
  hostWallId: string;
  position: CadPoint;
  openingDirection: "positive-normal" | "negative-normal" | "unknown";
  confidence: number;
};

export type WallGraph = {
  id: string;
  scale: ProjectScale;
  nodes: WallNode[];
  connections: WallConnection[];
  openings: OpeningRelation[];
};
