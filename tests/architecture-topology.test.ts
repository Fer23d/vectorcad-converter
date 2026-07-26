import { describe, expect, it } from "vitest";
import { ArchitectureRecognitionEngine } from "@/lib/architecture-recognition/architecture-engine";
import { architectureTopologyEngine, createProjectScale, pixelsToProjectUnits } from "@/lib/architecture-recognition/topology-engine";
import type { CadEntity } from "@/types/cad-geometry";

function line(id: string, start: { x: number; y: number }, end: { x: number; y: number }): CadEntity {
  return { id, type: "LINE", layer: "CONTOURS", source: "geometry-recognition", confidence: .98, coordinates: { start, end }, metadata: {} };
}

const recognition = new ArchitectureRecognitionEngine();

describe("Architecture topology", () => {
  it("connects walls that share a centerline endpoint", () => {
    const candidates = recognition.recognize([
      line("wall-a-top", { x: 0, y: 0 }, { x: 100, y: 0 }), line("wall-a-bottom", { x: 0, y: 12 }, { x: 100, y: 12 }),
      line("wall-b-top", { x: 100, y: 0 }, { x: 180, y: 0 }), line("wall-b-bottom", { x: 100, y: 12 }, { x: 180, y: 12 }),
    ]).candidates;
    const graph = architectureTopologyEngine.build(candidates);

    expect(graph.connections.some(connection => connection.type === "CONTINUITY")).toBe(true);
  });

  it("relates a detected door to its host wall", () => {
    const candidates = recognition.recognize([
      line("wall-top", { x: 0, y: 0 }, { x: 100, y: 0 }), line("wall-bottom", { x: 0, y: 12 }, { x: 100, y: 12 }), line("door", { x: 50, y: 6 }, { x: 50, y: 24 }),
    ]).candidates;
    const graph = architectureTopologyEngine.build(candidates);

    expect(graph.openings).toHaveLength(1);
    expect(graph.openings[0].openingType).toBe("DOOR");
  });

  it("detects a window from repeated short parallel opening markers", () => {
    const candidates = recognition.recognize([
      line("wall-top", { x: 0, y: 0 }, { x: 120, y: 0 }), line("wall-bottom", { x: 0, y: 12 }, { x: 120, y: 12 }),
      line("window-left", { x: 45, y: 6 }, { x: 45, y: 16 }), line("window-right", { x: 62, y: 6 }, { x: 62, y: 16 }),
    ]).candidates;

    expect(candidates.some(candidate => candidate.type === "WINDOW")).toBe(true);
  });

  it("converts pixels through the configured project scale", () => {
    const scale = createProjectScale({ pixelWidth: 2000, pixelHeight: 1000, projectWidth: 200, projectHeight: 100, unit: "mm" });

    expect(scale.pixelsPerUnit).toBe(10);
    expect(scale.conversionFactor).toBe(1);
    expect(pixelsToProjectUnits(500, scale)).toBe(50);
  });
});
