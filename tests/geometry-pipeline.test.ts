import { describe, expect, it } from "vitest";
import { recognizeDocumentGeometry } from "@/lib/geometry-recognition/recognition-engine";
import type { VectorDocument } from "@/types/vector";

function documentWithPath(path: VectorDocument["paths"][number]): VectorDocument {
  return { width: 100, height: 100, sourceWidth: 100, sourceHeight: 100, unit: "px", paths: [path] };
}

describe("geometry recognition pipeline integration", () => {
  it("preserves legacy paths while adding a LINE entity", () => {
    const document = documentWithPath({
      layer: "CONTOURS",
      closed: false,
      points: [{ x: 0, y: 0 }, { x: 20, y: .04 }, { x: 40, y: -.03 }, { x: 60, y: 0 }],
    });

    const result = recognizeDocumentGeometry(document);

    expect(result.document.paths).toEqual(document.paths);
    expect(result.document.entities?.[0].type).toBe("LINE");
    expect(result.document.entities?.[0].metadata.sourcePathId).toBe("path-1");
    expect(result.diagnostics.counts.LINE).toBe(1);
  });

  it("preserves legacy paths while adding a CIRCLE entity", () => {
    const points = Array.from({ length: 24 }, (_, index) => {
      const angle = index / 24 * Math.PI * 2;
      return { x: 50 + Math.cos(angle) * 15, y: 50 + Math.sin(angle) * 15 };
    });
    const document = documentWithPath({ layer: "DETAILS", closed: true, points });

    const result = recognizeDocumentGeometry(document, "mechanical");

    expect(result.document.paths).toEqual(document.paths);
    expect(result.document.entities?.[0].type).toBe("CIRCLE");
    expect(result.diagnostics.counts.CIRCLE).toBe(1);
  });

  it("keeps irregular geometry as LWPOLYLINE", () => {
    const document = documentWithPath({
      layer: "GUIDES",
      closed: false,
      points: [{ x: 0, y: 0 }, { x: 8, y: 11 }, { x: 17, y: -4 }, { x: 28, y: 13 }, { x: 40, y: 1 }],
    });

    const result = recognizeDocumentGeometry(document, "precision");

    expect(result.document.entities?.[0].type).toBe("LWPOLYLINE");
    expect(result.diagnostics.counts.LWPOLYLINE).toBe(1);
  });
});
