import { describe, expect, it } from "vitest";
import { IMAGE_COORDINATE_SYSTEM, pixelsToCoordinateUnits, transformPoint } from "@/lib/geometry/coordinate-transform";
import { scaleDocument } from "@/lib/vectorize/contours";
import type { VectorDocument } from "@/types/vector";

const coordinateSystem = {
  ...IMAGE_COORDINATE_SYSTEM,
  id: "test-image-coordinates",
};

function completeDocument(): VectorDocument {
  return {
    width: 100,
    height: 100,
    sourceWidth: 100,
    sourceHeight: 100,
    unit: "px",
    coordinateSystem,
    paths: [{ id: "path-1", layer: "CONTOURS", closed: false, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }],
    entities: [
      { id: "line-1", type: "LINE", layer: "CONTOURS", source: "geometry-recognition", confidence: .99, coordinates: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }, metadata: {} },
      { id: "circle-1", type: "CIRCLE", layer: "DETAILS", source: "geometry-recognition", confidence: .99, coordinates: { center: { x: 50, y: 50 }, radius: 25 }, metadata: {} },
    ],
    architectureEntities: [{
      id: "wall-1",
      type: "WALL",
      confidence: .95,
      sourceEntities: ["line-1"],
      geometry: {
        centerLine: { start: { x: 0, y: 45 }, end: { x: 100, y: 45 } },
        boundaries: [{ start: { x: 0, y: 40 }, end: { x: 100, y: 40 } }, { start: { x: 0, y: 50 }, end: { x: 100, y: 50 } }],
        thickness: 10,
        orientation: "horizontal",
        bounds: { minX: 0, minY: 40, maxX: 100, maxY: 50 },
      },
    }],
    projectScale: { unit: "px", pixelsPerUnit: 1, conversionFactor: 1 },
    topology: [{
      id: "graph-1",
      scale: { unit: "px", pixelsPerUnit: 1, conversionFactor: 1 },
      nodes: [{ id: "node-1", position: { x: 100, y: 45 }, wallIds: ["wall-1"], kind: "ENDPOINT" }],
      connections: [],
      openings: [{ id: "opening-1", openingId: "door-1", openingType: "DOOR", hostWallId: "wall-1", position: { x: 40, y: 45 }, openingDirection: "unknown", confidence: .8 }],
    }],
    bimModel: {
      version: "1.0",
      scale: { unit: "px", pixelsPerUnit: 1, conversionFactor: 1 },
      minimumConfidence: .75,
      walls: [{ id: "bim-wall-1", type: "WALL", geometry: { centerLine: { start: { x: 0, y: 45 }, end: { x: 100, y: 45 } }, bounds: { minX: 0, minY: 40, maxX: 100, maxY: 50 } }, thickness: 10, height: 2800, connections: [], openings: [], confidence: .95, sourceCandidateId: "wall-1" }],
      doors: [],
      windows: [],
      spaces: [],
      unconfirmedCandidateIds: [],
    },
  };
}

describe("canonical coordinate system", () => {
  it("scales a line by 2x", () => {
    const system = { ...coordinateSystem, scale: { x: 2, y: 2 } };
    expect(transformPoint({ x: 100, y: 0 }, system)).toEqual({ x: 200, y: 0 });
    expect(pixelsToCoordinateUnits(100, { ...system, unit: "millimeter" })).toBe(200);
  });

  it("keeps a circle as a circle with uniform scaling", () => {
    const document = scaleDocument(completeDocument(), 200, 200, "mm");
    const circle = document.entities?.find(entity => entity.id === "circle-1");

    expect(circle?.type).toBe("CIRCLE");
    if (circle?.type === "CIRCLE") expect(circle.coordinates.radius).toBe(50);
  });

  it("does not represent an anisotropically scaled circle as a false circle", () => {
    const document = scaleDocument(completeDocument(), 200, 100, "mm");
    const circle = document.entities?.find(entity => entity.id === "circle-1");

    expect(circle?.type).toBe("ELLIPSE");
    if (circle?.type === "ELLIPSE") {
      expect(circle.coordinates.majorRadius).toBe(50);
      expect(circle.coordinates.minorRadius).toBe(25);
    }
  });

  it("keeps paths, CAD entities, architecture, topology and BIM aligned", () => {
    const document = scaleDocument(completeDocument(), 200, 200, "mm");
    const line = document.entities?.find(entity => entity.id === "line-1");
    const wall = document.architectureEntities?.find(candidate => candidate.id === "wall-1");

    expect(document.paths[0].points[1]).toEqual({ x: 200, y: 0 });
    expect(line?.type).toBe("LINE");
    if (line?.type === "LINE") expect(line.coordinates.end).toEqual({ x: 200, y: 0 });
    if (wall?.type === "WALL") expect(wall.geometry.centerLine.end).toEqual({ x: 200, y: 90 });
    expect(document.topology?.[0].nodes[0].position).toEqual({ x: 200, y: 90 });
    expect(document.topology?.[0].openings[0].position).toEqual({ x: 80, y: 90 });
    expect(document.bimModel?.walls[0].geometry.centerLine.end).toEqual({ x: 200, y: 90 });
    expect(document.coordinateSystem?.unit).toBe("millimeter");
  });
});
