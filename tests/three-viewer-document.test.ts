import { describe, expect, it } from "vitest";
import { prepareThreeViewerDocument } from "@/lib/three-viewer-document";
import type { VectorDocument } from "@/types/vector";

function legacyDocument(): VectorDocument {
  return {
    width: 100,
    height: 50,
    sourceWidth: 100,
    sourceHeight: 50,
    unit: "px",
    paths: [{ id: "legacy-path", layer: "CONTOURS", closed: true, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }] }],
  };
}

describe("3D viewer document preparation", () => {
  it("keeps legacy paths available for a standalone 3D page", () => {
    const prepared = prepareThreeViewerDocument(legacyDocument(), 200, 100, "mm");

    expect(prepared.hasGeometry).toBe(true);
    expect(prepared.document.paths[0].points[2]).toEqual({ x: 200, y: 100 });
    expect(prepared.document.coordinateSystem?.unit).toBe("millimeter");
  });

  it("preserves rich CAD entities and canonical coordinates", () => {
    const document: VectorDocument = {
      ...legacyDocument(),
      coordinateSystem: { id: "cad-mm", origin: { x: 0, y: 0 }, scale: { x: 2, y: 2 }, rotation: 0, unit: "millimeter", precision: 6, createdFrom: "manual" },
      width: 200,
      height: 100,
      unit: "mm",
      entities: [
        { id: "line-1", type: "LINE", layer: "CONTOURS", source: "geometry-recognition", confidence: .99, coordinates: { start: { x: 0, y: 0 }, end: { x: 200, y: 0 } }, metadata: {} },
        { id: "circle-1", type: "CIRCLE", layer: "DETAILS", source: "geometry-recognition", confidence: .98, coordinates: { center: { x: 100, y: 50 }, radius: 20 }, metadata: {} },
      ],
    };
    const prepared = prepareThreeViewerDocument(document, 200, 100, "mm");

    expect(prepared.hasGeometry).toBe(true);
    expect(prepared.document.entities).toHaveLength(2);
    expect(prepared.document.entities?.[0].coordinates).toEqual({ start: { x: 0, y: 0 }, end: { x: 200, y: 0 } });
    expect(prepared.coordinateSystemPreserved).toBe(true);
    expect(prepared.document.coordinateSystem?.id).toBe("cad-mm");
  });

  it("preserves proportion when dimensions change together", () => {
    const prepared = prepareThreeViewerDocument(legacyDocument(), 300, 150, "mm");
    const last = prepared.document.paths[0].points[2];

    expect(last.x / last.y).toBe(2);
    expect(prepared.document.width / prepared.document.height).toBe(2);
  });

  it("keeps manual coordinate calibration, architecture and topology intact when no target transform is requested", () => {
    const document: VectorDocument = {
      ...legacyDocument(),
      coordinateSystem: { id: "imported-rotated", origin: { x: 17, y: -4 }, scale: { x: 2.5, y: 2.5 }, rotation: 0.2, unit: "millimeter", precision: 6, createdFrom: "imported" },
      width: 100,
      height: 50,
      unit: "mm",
      architectureEntities: [{
        id: "wall-1",
        type: "WALL",
        confidence: 0.9,
        sourceEntities: [],
        geometry: {
          centerLine: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
          boundaries: [{ start: { x: 0, y: -5 }, end: { x: 100, y: -5 } }, { start: { x: 0, y: 5 }, end: { x: 100, y: 5 } }],
          thickness: 10,
          orientation: "horizontal",
          bounds: { minX: 0, minY: -5, maxX: 100, maxY: 5 },
        },
      }],
      topology: [{ id: "graph-1", scale: { unit: "mm", pixelsPerUnit: 1, conversionFactor: 1 }, nodes: [{ id: "node-1", position: { x: 0, y: 0 }, wallIds: ["wall-1"], kind: "ENDPOINT" }], connections: [], openings: [] }],
    };

    const prepared = prepareThreeViewerDocument(document, 100, 50, "mm");

    expect(prepared.coordinateSystemPreserved).toBe(true);
    expect(prepared.document).toBe(document);
    expect(prepared.document.architectureEntities).toHaveLength(1);
    expect(prepared.document.topology).toHaveLength(1);
  });
});
