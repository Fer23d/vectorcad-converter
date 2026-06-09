import { describe, expect, it } from "vitest";
import DxfParser from "dxf-parser";
import { Helper } from "dxf";
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
    const entities = new DxfParser().parseSync(generateDxf(scaleDocument(result, 100, 100, "mm")))?.entities || [];
    expect(entities.length).toBeGreaterThanOrEqual(4);
    expect(entities.every(entity => entity.type === "LINE")).toBe(true);
  });

  it("generates a clean SVG path", () => {
    const svg = generateSvg(doc);
    expect(svg).toContain("<path");
    expect(svg).toContain('viewBox="0 0 10 10"');
  });

  it("generates universally compatible editable DXF lines and CAD layers", () => {
    const dxf = generateDxf(doc);
    expect(dxf).toContain("\r\nLINE\r\n");
    expect(dxf).toContain("AC1021");
    expect(dxf).toContain("AcDbLine");
    expect(dxf).toContain("*ACTIVE");
    expect(dxf).toContain("$VIEWCTR");
    expect(dxf).toContain("$VIEWSIZE");
    expect(dxf).toContain("BLOCK_RECORD");
    expect(dxf).toContain("*Model_Space");
    expect(dxf).toContain("OBJECTS");
    expect(dxf).toContain("CONTOURS");
    expect(dxf).toContain("DETAILS");
    expect(dxf).toContain("\r\n");
    const parsed = new DxfParser().parseSync(dxf);
    expect(parsed?.entities).toHaveLength(4);
    expect(parsed?.entities[0].type).toBe("LINE");
    expect(parsed?.entities[0].layer).toBe("CONTOURS");
    const rendered = new Helper(dxf);
    expect(rendered.toPolylines().polylines).toHaveLength(4);
    expect(rendered.toSVG()).toContain("<svg");
  });

  it("opens the CAD viewport centered on the exported geometry", () => {
    const offset: VectorDocument = {
      ...doc,
      width: 1000,
      height: 1000,
      paths: [{ closed: true, layer: "CONTOURS", points: [{ x: 400, y: 400 }, { x: 500, y: 400 }, { x: 500, y: 500 }, { x: 400, y: 500 }, { x: 400, y: 400 }] }],
    };
    const dxf = generateDxf(offset);
    const parsed = new DxfParser().parseSync(dxf);
    expect(parsed?.header.$EXTMIN).toMatchObject({ x: 400, y: 500 });
    expect(parsed?.header.$EXTMAX).toMatchObject({ x: 500, y: 600 });
    expect(parsed?.header.$VIEWCTR).toMatchObject({ x: 450, y: 550 });
    expect(parsed?.header.$VIEWSIZE).toBeGreaterThan(100);
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
