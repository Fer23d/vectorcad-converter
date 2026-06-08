import { describe, expect, it } from "vitest";
import DxfParser from "dxf-parser";
import { removeIsolated } from "@/lib/image-processing/process";
import { countDxfEntities, generateDxf } from "@/lib/exporters/dxf";
import { generateSvg } from "@/lib/exporters/svg";
import { scaleDocument, vectorizeBitmap } from "@/lib/vectorize/contours";
import type { VectorDocument } from "@/types/vector";

const doc: VectorDocument = {
  width: 10, height: 10, sourceWidth: 10, sourceHeight: 10, unit: "px",
  paths: [{ closed: true, layer: "CONTOURS", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }] }],
};

describe("VectorCAD pipeline", () => {
  it("converts a bitmap into a closed editable contour", () => {
    const bitmap = new Uint8Array([0,0,0,0, 0,1,1,0, 0,1,1,0, 0,0,0,0]);
    const result = vectorizeBitmap(bitmap, 4, 4, { mode: "logo", simplification: 0, minArea: 1, closePaths: true, joinDistance: 1 });
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0].closed).toBe(true);
  });

  it("keeps closed contours valid after default simplification", () => {
    const bitmap = new Uint8Array(36);
    for (let y = 1; y < 5; y++) for (let x = 1; x < 5; x++) bitmap[y * 6 + x] = 1;
    const result = vectorizeBitmap(bitmap, 6, 6, { mode: "logo", simplification: 1.8, minArea: 1, closePaths: true, joinDistance: 1 });
    expect(result.paths[0].points.length).toBeGreaterThanOrEqual(4);
    expect(countDxfEntities(scaleDocument(result, 100, 100, "mm"))).toBe(1);
    expect(new DxfParser().parseSync(generateDxf(scaleDocument(result, 100, 100, "mm")))?.entities).toHaveLength(1);
  });

  it("generates a clean SVG path", () => {
    const svg = generateSvg(doc);
    expect(svg).toContain("<path");
    expect(svg).toContain('viewBox="0 0 10 10"');
  });

  it("generates editable DXF LWPOLYLINE and CAD layers", () => {
    const dxf = generateDxf(doc);
    expect(dxf).toContain("LWPOLYLINE");
    expect(dxf).toContain("AC1015");
    expect(dxf).toContain("AcDbPolyline");
    expect(dxf).toContain("CONTOURS");
    expect(dxf).toContain("DETAILS");
    expect(dxf).toContain("\r\n");
    const parsed = new DxfParser().parseSync(dxf);
    expect(parsed?.entities).toHaveLength(1);
    expect(parsed?.entities[0].type).toBe("LWPOLYLINE");
    expect(parsed?.entities[0].layer).toBe("CONTOURS");
    expect(parsed?.entities[0].vertices).toHaveLength(4);
  });

  it("does not export invalid CAD entities", () => {
    const invalid: VectorDocument = { ...doc, paths: [{ closed: true, layer: "CONTOURS", points: [{ x: 1, y: 1 }, { x: 1, y: 1 }] }] };
    expect(countDxfEntities(invalid)).toBe(0);
    expect(new DxfParser().parseSync(generateDxf(invalid))?.entities).toHaveLength(0);
  });

  it("removes isolated noise", () => {
    const data = new Uint8Array(25); data[12] = 1;
    removeIsolated(data, 5, 5);
    expect(data[12]).toBe(0);
  });

  it("scales coordinates to millimeters", () => {
    const scaled = scaleDocument(doc, 100, 50, "mm");
    expect(scaled.paths[0].points[2]).toEqual({ x: 100, y: 50 });
    expect(scaled.unit).toBe("mm");
  });
});
