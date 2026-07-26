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
    expect(prepared.document.coordinateSystem?.id).toBe("document-mm-200x100");
  });

  it("preserves proportion when dimensions change together", () => {
    const prepared = prepareThreeViewerDocument(legacyDocument(), 300, 150, "mm");
    const last = prepared.document.paths[0].points[2];

    expect(last.x / last.y).toBe(2);
    expect(prepared.document.width / prepared.document.height).toBe(2);
  });
});
