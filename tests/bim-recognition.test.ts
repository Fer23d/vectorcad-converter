import { describe, expect, it } from "vitest";
import { ArchitectureRecognitionEngine } from "@/lib/architecture-recognition/architecture-engine";
import { createDocumentTopology, createProjectScale } from "@/lib/architecture-recognition/topology-engine";
import { bimRecognitionEngine } from "@/lib/bim-recognition/bim-engine";
import type { CadEntity } from "@/types/cad-geometry";
import type { VectorDocument } from "@/types/vector";

function line(id: string, start: { x: number; y: number }, end: { x: number; y: number }): CadEntity {
  return { id, type: "LINE", layer: "CONTOURS", source: "geometry-recognition", confidence: .98, coordinates: { start, end }, metadata: {} };
}

function documentFromEntities(entities: CadEntity[]): VectorDocument {
  const recognition = new ArchitectureRecognitionEngine().recognize(entities);
  const base: VectorDocument = { width: 100, height: 100, sourceWidth: 100, sourceHeight: 100, unit: "mm", paths: [], entities, architectureEntities: recognition.candidates };
  return createDocumentTopology(base, createProjectScale({ pixelWidth: 100, pixelHeight: 100, projectWidth: 100, projectHeight: 100, unit: "mm" })).document;
}

describe("BimRecognitionEngine", () => {
  it("promotes a confirmed wall into BimWall", () => {
    const model = bimRecognitionEngine.build(documentFromEntities([line("top", { x: 0, y: 0 }, { x: 100, y: 0 }), line("bottom", { x: 0, y: 12 }, { x: 100, y: 12 })]));

    expect(model.walls).toHaveLength(1);
    expect(model.walls[0].type).toBe("WALL");
    expect(model.walls[0].thickness).toBe(12);
  });

  it("keeps a confirmed door attached to its BimWall", () => {
    const model = bimRecognitionEngine.build(documentFromEntities([
      line("top", { x: 0, y: 0 }, { x: 100, y: 0 }), line("bottom", { x: 0, y: 12 }, { x: 100, y: 12 }), line("door", { x: 50, y: 6 }, { x: 50, y: 24 }),
    ]));

    expect(model.doors).toHaveLength(1);
    expect(model.walls[0].openings).toContain(model.doors[0].id);
    expect(model.doors[0].hostWallId).toBe(model.walls[0].id);
  });

  it("keeps a confirmed window attached to its BimWall", () => {
    const model = bimRecognitionEngine.build(documentFromEntities([
      line("top", { x: 0, y: 0 }, { x: 120, y: 0 }), line("bottom", { x: 0, y: 12 }, { x: 120, y: 12 }),
      line("window-left", { x: 45, y: 6 }, { x: 45, y: 16 }), line("window-right", { x: 62, y: 6 }, { x: 62, y: 16 }),
    ]));

    expect(model.windows).toHaveLength(1);
    expect(model.windows[0].hostWallId).toBe(model.walls[0].id);
  });

  it("promotes room area in project units", () => {
    const document: VectorDocument = {
      width: 100,
      height: 100,
      sourceWidth: 100,
      sourceHeight: 100,
      unit: "mm",
      paths: [],
      architectureEntities: [{
        id: "room-1",
        type: "ROOM",
        confidence: .95,
        sourceEntities: [],
        geometry: {
          boundary: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }],
          area: 200,
          bounds: { minX: 0, minY: 0, maxX: 20, maxY: 10 },
        },
      }],
      projectScale: { unit: "mm", pixelsPerUnit: 2, conversionFactor: 1 },
    };
    const model = bimRecognitionEngine.build(document);

    expect(model.spaces).toHaveLength(1);
    expect(model.spaces[0].area).toBe(50);
  });
});
