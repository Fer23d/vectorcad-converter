import DxfParser from "dxf-parser";
import { describe, expect, it } from "vitest";
import { generateDxf } from "@/lib/exporters/dxf";
import { generateSvg } from "@/lib/exporters/svg";
import type { VectorDocument } from "@/types/vector";

const baseDocument: Omit<VectorDocument, "paths" | "entities"> = {
  width: 100,
  height: 100,
  sourceWidth: 100,
  sourceHeight: 100,
  unit: "mm",
};

describe("CAD entity exporters", () => {
  it("uses a LINE entity for DXF and SVG when entities are available", () => {
    const document: VectorDocument = {
      ...baseDocument,
      paths: [{ id: "path-1", layer: "CONTOURS", closed: false, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }],
      entities: [{ id: "line-1", type: "LINE", layer: "DETAILS", source: "geometry-recognition", confidence: .98, coordinates: { start: { x: 10, y: 20 }, end: { x: 80, y: 20 } }, metadata: { sourcePathId: "path-1" } }],
    };

    const dxf = generateDxf(document);
    const svg = generateSvg(document);
    const entities = new DxfParser().parseSync(dxf)?.entities || [];

    expect(entities).toHaveLength(1);
    expect(entities[0].type).toBe("LINE");
    expect(svg).toContain("<line");
    expect(svg).not.toContain("<path");
  });

  it("uses a CIRCLE entity for DXF and SVG when entities are available", () => {
    const document: VectorDocument = {
      ...baseDocument,
      paths: [],
      entities: [{ id: "circle-1", type: "CIRCLE", layer: "CONTOURS", source: "geometry-recognition", confidence: .96, coordinates: { center: { x: 50, y: 50 }, radius: 12 }, metadata: {} }],
    };

    const dxf = generateDxf(document);
    const svg = generateSvg(document);
    const entities = new DxfParser().parseSync(dxf)?.entities || [];

    expect(entities).toHaveLength(1);
    expect(entities[0].type).toBe("CIRCLE");
    expect(svg).toContain("<circle");
  });

  it("exports ELLIPSE natively without fabricating a circle", () => {
    const document: VectorDocument = {
      ...baseDocument,
      paths: [],
      entities: [{
        id: "ellipse-1",
        type: "ELLIPSE",
        layer: "GEOMETRY",
        source: "manual",
        confidence: 1,
        coordinates: { center: { x: 50, y: 50 }, majorRadius: 24, minorRadius: 8, rotation: Math.PI / 6 },
        metadata: { deformedByNonUniformScale: true },
      }],
    };

    const dxf = generateDxf(document);
    const svg = generateSvg(document);

    expect(dxf).toContain("ELLIPSE");
    expect(dxf).not.toContain("\nCIRCLE\n");
    expect(svg).toContain("<ellipse");
    expect(svg).not.toContain("<circle");
  });

  it("preserves native entities and unmatched legacy paths in a mixed document", () => {
    const document: VectorDocument = {
      ...baseDocument,
      paths: [
        { id: "path-line", layer: "CONTOURS", closed: false, points: [{ x: 10, y: 10 }, { x: 90, y: 10 }] },
        { id: "path-arc", layer: "DETAILS", closed: false, points: [{ x: 20, y: 80 }, { x: 50, y: 50 }, { x: 80, y: 80 }] },
        { id: "path-legacy", layer: "GUIDES", closed: false, points: [{ x: 5, y: 90 }, { x: 95, y: 90 }] },
      ],
      entities: [
        { id: "line-1", type: "LINE", layer: "GEOMETRY", source: "geometry-recognition", confidence: .99, coordinates: { start: { x: 10, y: 10 }, end: { x: 90, y: 10 } }, metadata: { sourcePathId: "path-line" } },
        { id: "arc-1", type: "ARC", layer: "GEOMETRY", source: "manual", confidence: 1, coordinates: { center: { x: 50, y: 80 }, radius: 30, startAngle: Math.PI, endAngle: Math.PI * 2 }, metadata: { sourcePathId: "path-arc" } },
      ],
    };

    const dxf = generateDxf(document);
    const svg = generateSvg(document);
    const parsed = new DxfParser().parseSync(dxf)?.entities || [];

    expect(parsed.map(entity => entity.type)).toEqual(expect.arrayContaining(["LINE", "ARC", "LWPOLYLINE"]));
    expect(svg).toContain("<line");
    expect(svg.match(/<path/g)).toHaveLength(2);
  });

  it("keeps legacy path exports working when a document has no entities", () => {
    const document: VectorDocument = {
      ...baseDocument,
      paths: [{ layer: "CONTOURS", closed: true, points: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }] }],
    };

    const dxf = generateDxf(document);
    const svg = generateSvg(document);
    const entities = new DxfParser().parseSync(dxf)?.entities || [];

    expect(entities).toHaveLength(1);
    expect(entities[0].type).toBe("LWPOLYLINE");
    expect(svg).toContain("<path");
  });
});
