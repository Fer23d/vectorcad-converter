import { describe, expect, it } from "vitest";
import { ArchitectureRecognitionEngine, recognizeDocumentArchitecture } from "@/lib/architecture-recognition/architecture-engine";
import { skeletonizeBitmap } from "@/lib/vectorize/skeleton";
import type { CadEntity } from "@/types/cad-geometry";
import type { VectorDocument } from "@/types/vector";

function line(id: string, start: { x: number; y: number }, end: { x: number; y: number }): CadEntity {
  return { id, type: "LINE", layer: "CONTOURS", source: "geometry-recognition", confidence: .98, coordinates: { start, end }, metadata: {} };
}

const engine = new ArchitectureRecognitionEngine();

describe("ArchitectureRecognitionEngine", () => {
  it("creates a WallCandidate from close parallel orthogonal lines", () => {
    const result = engine.recognize([line("wall-top", { x: 0, y: 0 }, { x: 100, y: 0 }), line("wall-bottom", { x: 0, y: 12 }, { x: 100, y: 12 })]);

    expect(result.candidates.some(candidate => candidate.type === "WALL")).toBe(true);
  });

  it("creates a RoomCandidate from a closed orthogonal polyline", () => {
    const document: VectorDocument = {
      width: 100,
      height: 100,
      sourceWidth: 100,
      sourceHeight: 100,
      unit: "px",
      paths: [],
      entities: [{ id: "room-outline", type: "LWPOLYLINE", layer: "CONTOURS", source: "contour-extraction", confidence: .9, coordinates: { closed: true, points: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 70 }, { x: 10, y: 70 }] }, metadata: {} }],
    };

    const result = recognizeDocumentArchitecture(document);

    expect(result.document.architectureEntities?.some(candidate => candidate.type === "ROOM")).toBe(true);
  });

  it("creates a DoorCandidate for a short perpendicular opening marker on a wall", () => {
    const result = engine.recognize([
      line("wall-top", { x: 0, y: 0 }, { x: 100, y: 0 }),
      line("wall-bottom", { x: 0, y: 12 }, { x: 100, y: 12 }),
      line("door-marker", { x: 50, y: 6 }, { x: 50, y: 24 }),
    ]);

    expect(result.candidates.some(candidate => candidate.type === "DOOR")).toBe(true);
  });

  it("thins a binary technical stroke into a centerline mask", () => {
    const bitmap = new Uint8Array(49);
    for (let y = 1; y < 6; y++) for (let x = 2; x < 5; x++) bitmap[y * 7 + x] = 1;
    const skeleton = skeletonizeBitmap(bitmap, 7, 7);

    expect(skeleton.removedPixels).toBeGreaterThan(0);
    expect(skeleton.data.some(Boolean)).toBe(true);
  });
});
