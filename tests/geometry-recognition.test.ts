import { describe, expect, it } from "vitest";
import { GeometryRecognitionEngine } from "@/lib/geometry-recognition/recognition-engine";
import type { VectorPath } from "@/types/vector";

const engine = new GeometryRecognitionEngine();

describe("GeometryRecognitionEngine", () => {
  it("converts a high-confidence straight path into a LINE", () => {
    const path: VectorPath = {
      layer: "CONTOURS",
      closed: false,
      points: [{ x: 0, y: 0 }, { x: 20, y: 0.08 }, { x: 40, y: -0.05 }, { x: 60, y: 0.03 }, { x: 80, y: 0 }],
    };

    const entity = engine.recognizePath(path);

    expect(entity.type).toBe("LINE");
    expect(entity.confidence).toBeGreaterThan(.9);
    expect(entity.metadata.fitError).toBeLessThan(1.25);
  });

  it("converts a high-confidence closed circular path into a CIRCLE", () => {
    const points = Array.from({ length: 32 }, (_, index) => {
      const angle = index / 32 * Math.PI * 2;
      return { x: 50 + Math.cos(angle) * 20, y: 50 + Math.sin(angle) * 20 };
    });
    const path: VectorPath = { layer: "DETAILS", closed: true, points };

    const entity = engine.recognizePath(path);

    expect(entity.type).toBe("CIRCLE");
    if (entity.type !== "CIRCLE") throw new Error("Expected CIRCLE");
    expect(entity.coordinates.center.x).toBeCloseTo(50, 3);
    expect(entity.coordinates.center.y).toBeCloseTo(50, 3);
    expect(entity.coordinates.radius).toBeCloseTo(20, 3);
    expect(entity.confidence).toBeGreaterThan(.9);
  });

  it("keeps an irregular path as LWPOLYLINE", () => {
    const path: VectorPath = {
      layer: "GUIDES",
      closed: false,
      points: [{ x: 0, y: 0 }, { x: 10, y: 12 }, { x: 18, y: -5 }, { x: 30, y: 15 }, { x: 42, y: 3 }],
    };

    const entity = engine.recognizePath(path);

    expect(entity.type).toBe("LWPOLYLINE");
    expect(entity.coordinates).toMatchObject({ closed: false, points: path.points });
  });
});
