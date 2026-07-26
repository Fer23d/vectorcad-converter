import { describe, expect, it } from "vitest";
import { getViewerGeometry } from "@/lib/cad-geometry/legacy-adapter";
import { prepareThreeViewerDocument } from "@/lib/three-viewer-document";
import type { VectorDocument } from "@/types/vector";

const baseDocument: VectorDocument = {
  width: 100,
  height: 100,
  sourceWidth: 100,
  sourceHeight: 100,
  unit: "mm",
  paths: [
    { id: "recognized-path", layer: "CONTOURS", closed: false, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
    { id: "legacy-path", layer: "DETAILS", closed: false, points: [{ x: 0, y: 5 }, { x: 10, y: 5 }] },
  ],
  entities: [{
    id: "line-1",
    type: "LINE",
    layer: "CONTOURS",
    source: "geometry-recognition",
    confidence: 0.99,
    coordinates: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
    metadata: { sourcePathId: "recognized-path" },
  }],
  coordinateSystem: {
    id: "manual-mm",
    origin: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    unit: "millimeter",
    precision: 6,
    createdFrom: "manual",
  },
};

describe("standalone 3D viewer document", () => {
  it("keeps native entities and uncovered legacy paths in a mixed document", () => {
    const resolved = getViewerGeometry(baseDocument);
    expect(resolved.source).toBe("mixed");
    expect(resolved.entities).toHaveLength(2);
    expect(resolved.entities.map((entity) => entity.type)).toEqual(["LINE", "LWPOLYLINE"]);
  });

  it("falls back to legacy paths when a persisted entity is invalid", () => {
    const resolved = getViewerGeometry({
      ...baseDocument,
      entities: [{ ...baseDocument.entities![0], type: "CIRCLE", coordinates: { center: { x: 0, y: 0 }, radius: 0 } }],
    });
    expect(resolved.source).toBe("legacy-paths");
    expect(resolved.entities).toHaveLength(2);
    expect(resolved.invalidEntityCount).toBe(1);
  });

  it("does not transform a document already expressed in its requested coordinate system", () => {
    const prepared = prepareThreeViewerDocument(baseDocument, { width: 100, height: 100, unit: "mm" });
    expect(prepared.coordinateSystemPreserved).toBe(true);
    expect(prepared.document).toBe(baseDocument);
    expect(prepared.hasGeometry).toBe(true);
  });
});
