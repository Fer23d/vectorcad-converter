import { describe, expect, it } from "vitest";
import DxfParser from "dxf-parser";
import { Helper } from "dxf";
import { closeBinary, removeSmallComponents } from "@/lib/image-processing/binary";
import { removeIsolated } from "@/lib/image-processing/process";
import { countDxfEntities, generateDxf } from "@/lib/exporters/dxf";
import { generateSvg } from "@/lib/exporters/svg";
import { chaikin, joinNearbyPaths } from "@/lib/vectorize/geometry";
import { scaleDocument, vectorizeBitmap } from "@/lib/vectorize/contours";
import type { VectorDocument, VectorSettings } from "@/types/vector";

const doc: VectorDocument = {
  width: 10, height: 10, sourceWidth: 10, sourceHeight: 10, unit: "px",
  paths: [{ closed: true, layer: "CONTOURS", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }] }],
};
const settings: VectorSettings = { mode: "logo", outputMode: "smooth", simplification: 1.8, minArea: 1, smoothIterations: 1, closePaths: true, joinDistance: 2 };

describe("VectorCAD pipeline", () => {
  it("converts a bitmap into a closed editable contour", () => {
    const bitmap = new Uint8Array([0,0,0,0, 0,1,1,0, 0,1,1,0, 0,0,0,0]);
    const result = vectorizeBitmap(bitmap, 4, 4, { ...settings, outputMode: "pixel", simplification: 0, smoothIterations: 0, joinDistance: 1 });
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0].closed).toBe(true);
  });

  it("keeps closed contours valid after default simplification", () => {
    const bitmap = new Uint8Array(36);
    for (let y = 1; y < 5; y++) for (let x = 1; x < 5; x++) bitmap[y * 6 + x] = 1;
    const result = vectorizeBitmap(bitmap, 6, 6, { ...settings, joinDistance: 1 });
    expect(result.paths[0].points.length).toBeGreaterThanOrEqual(4);
    expect(countDxfEntities(scaleDocument(result, 100, 100, "mm"))).toBe(1);
    const entities = new DxfParser().parseSync(generateDxf(scaleDocument(result, 100, 100, "mm")))?.entities || [];
    expect(entities).toHaveLength(1);
    expect(entities[0].type).toBe("LWPOLYLINE");
  });

  it("generates a clean SVG path", () => {
    const svg = generateSvg(doc);
    expect(svg).toContain("<path");
    expect(svg).toContain('viewBox="0 0 10 10"');
  });

  it("generates clean editable DXF polylines and CAD layers", () => {
    const dxf = generateDxf(doc);
    expect(dxf).toContain("LWPOLYLINE");
    expect(dxf).toContain("AC1021");
    expect(dxf).toContain("AcDbPolyline");
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
    expect(parsed?.entities).toHaveLength(1);
    expect(parsed?.entities[0].type).toBe("LWPOLYLINE");
    expect(parsed?.entities[0].layer).toBe("CONTOURS");
    const rendered = new Helper(dxf);
    expect(rendered.toPolylines().polylines).toHaveLength(1);
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

  it("closes small binary gaps and removes small components", () => {
    const bitmap = new Uint8Array(49);
    for (let x = 1; x < 6; x++) bitmap[3 * 7 + x] = 1;
    bitmap[3 * 7 + 3] = 0;
    bitmap[0] = 1;
    const closed = closeBinary(bitmap, 7, 7, 1);
    expect(closed[3 * 7 + 3]).toBe(1);
    expect(removeSmallComponents(closed, 7, 7, 3)[0]).toBe(0);
  });

  it("joins nearby open paths and smooths corners", () => {
    const joined = joinNearbyPaths([[{ x: 0, y: 0 }, { x: 3, y: 0 }], [{ x: 4, y: 0 }, { x: 8, y: 0 }]], 1.1);
    expect(joined).toHaveLength(1);
    expect(joined[0]).toHaveLength(4);
    expect(chaikin([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], true, 1)).toHaveLength(8);
  });

  it("reduces stair-step points while preserving a closed contour", () => {
    const bitmap = new Uint8Array(400);
    for (let y = 4; y < 16; y++) for (let x = 4; x < 16; x++) bitmap[y * 20 + x] = 1;
    const pixel = vectorizeBitmap(bitmap, 20, 20, { ...settings, outputMode: "pixel", simplification: 0, smoothIterations: 0 });
    const clean = vectorizeBitmap(bitmap, 20, 20, { ...settings, outputMode: "cad", simplification: 2, smoothIterations: 0 });
    expect(clean.paths[0].closed).toBe(true);
    expect(clean.paths[0].points.length).toBeLessThan(pixel.paths[0].points.length);
  });

  it("scales coordinates to millimeters", () => {
    const scaled = scaleDocument(doc, 100, 50, "mm");
    expect(scaled.paths[0].points[2]).toEqual({ x: 100, y: 50 });
    expect(scaled.unit).toBe("mm");
  });
});
