import { describe, expect, it } from "vitest";
import { getCadEntities, getViewerGeometry, vectorPathToCadEntity, withCadEntities } from "@/lib/cad-geometry/legacy-adapter";
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

  it("keeps legacy paths that are not represented by partial recognition results", () => {
    const document: VectorDocument = {
      ...legacyDocument,
      paths: [
        { ...legacyPath, id: "path-recognized" },
        { ...legacyPath, id: "path-legacy", layer: "DETAILS" },
      ],
      entities: [{
        id: "line-1",
        type: "LINE",
        layer: "CONTOURS",
        source: "geometry-recognition",
        confidence: 0.99,
        coordinates: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
        metadata: { sourcePathId: "path-recognized" },
      }],
    };

    const resolved = getViewerGeometry(document);

    expect(resolved.source).toBe("mixed");
    expect(resolved.entities).toHaveLength(2);
    expect(resolved.entities[1]).toMatchObject({ type: "LWPOLYLINE", layer: "DETAILS" });
  });

  it("keeps valid CAD entities and ignores malformed persisted geometry", () => {
    const document: VectorDocument = {
      ...legacyDocument,
      paths: [],
      entities: [
        {
          id: "line-1",
          type: "LINE",
          layer: "CONTOURS",
          source: "geometry-recognition",
          confidence: 0.99,
          coordinates: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
          metadata: {},
        },
        {
          id: "invalid-circle",
          type: "CIRCLE",
          layer: "DETAILS",
          source: "geometry-recognition",
          confidence: 0.2,
          coordinates: { center: { x: 5, y: 5 }, radius: Number.NaN },
          metadata: {},
        },
      ],
    };

    const resolved = getViewerGeometry(document);

    expect(resolved.source).toBe("entities");
    expect(resolved.entities).toHaveLength(1);
    expect(resolved.invalidEntityCount).toBe(1);
  });
});
