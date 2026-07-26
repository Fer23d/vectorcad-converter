import { describe, expect, it } from "vitest";
import { getCadEntities, vectorPathToCadEntity, withCadEntities } from "@/lib/cad-geometry/legacy-adapter";
import type { VectorDocument, VectorPath } from "@/types/vector";

const legacyPath: VectorPath = {
  layer: "CONTOURS",
  closed: true,
  curved: true,
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
};

const legacyDocument: VectorDocument = {
  width: 10,
  height: 10,
  sourceWidth: 10,
  sourceHeight: 10,
  unit: "px",
  paths: [legacyPath],
};

describe("CAD Geometry Model compatibility", () => {
  it("adapts a legacy VectorPath to an equivalent CAD polyline without mutating it", () => {
    const entity = vectorPathToCadEntity(legacyPath, 3);

    expect(entity).toMatchObject({
      id: "legacy-path-4",
      type: "LWPOLYLINE",
      layer: "CONTOURS",
      source: "legacy-vector-path",
      confidence: 1,
      coordinates: { closed: true, points: legacyPath.points },
      metadata: { legacyPathIndex: 3, curved: true },
    });
    expect(entity.coordinates.points).not.toBe(legacyPath.points);
  });

  it("keeps existing project documents compatible while adding an optional entity view", () => {
    const normalized = withCadEntities(legacyDocument);

    expect(normalized.paths).toEqual(legacyDocument.paths);
    expect(normalized.entities).toHaveLength(1);
    expect(normalized.entities?.[0].type).toBe("LWPOLYLINE");
    expect(getCadEntities(legacyDocument)).toEqual(normalized.entities);
  });

  it("preserves entities already produced by a future recognition engine", () => {
    const document: VectorDocument = {
      ...legacyDocument,
      entities: [{
        id: "circle-1",
        type: "CIRCLE",
        layer: "DETAILS",
        source: "geometry-recognition",
        confidence: 0.97,
        coordinates: { center: { x: 5, y: 5 }, radius: 2 },
        metadata: { fitError: 0.08 },
      }],
    };

    expect(withCadEntities(document)).toBe(document);
    expect(getCadEntities(document)[0].type).toBe("CIRCLE");
  });
});
