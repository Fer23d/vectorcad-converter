import type { Point, VectorPath } from "@/types/vector";

export type LineClassification = "STRONG_LINE" | "MEDIUM_LINE" | "WEAK_LINE";

export type IntelligentLine = {
  id: string;
  type: "LINE" | "POLYLINE" | "CURVE";
  points: Point[];
  confidence: number;
  classification: LineClassification;
  length: number;
  angle: number;
};

export type LineIntelligenceMetrics = {
  detected: number;
  kept: number;
  removed: number;
  reductionPercent: number;
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(points: Point[]) {
  return points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
}

function angleDelta(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function pathStability(points: Point[]) {
  if (points.length < 3) return 1;
  const angles = points.slice(1).map((point, index) => Math.atan2(point.y - points[index].y, point.x - points[index].x));
  const total = angles.slice(1).reduce((sum, angle, index) => sum + angleDelta(angle, angles[index]), 0);
  return Math.max(0, 1 - total / Math.max(1, (angles.length - 1) * Math.PI));
}

function classify(path: VectorPath, width: number, height: number, length: number, stability: number): IntelligentLine {
  const first = path.points[0] || { x: 0, y: 0 };
  const last = path.points[path.points.length - 1] || first;
  const diagonal = Math.hypot(width, height) || 1;
  const normalizedLength = length / diagonal;
  const confidence = Math.max(0, Math.min(1, stability * .65 + Math.min(1, normalizedLength) * .35));
  const classification: LineClassification = path.points.length < 2 || length < diagonal * .002
    ? "WEAK_LINE"
    : confidence >= .62 || path.closed || normalizedLength >= .08
      ? "STRONG_LINE"
      : "MEDIUM_LINE";
  return {
    id: `line-${path.layer}-${Math.round(first.x)}-${Math.round(first.y)}-${path.points.length}`,
    type: path.curved ? "CURVE" : path.closed || path.points.length > 2 ? "POLYLINE" : "LINE",
    points: path.points.map(point => ({ ...point })),
    confidence,
    classification,
    length,
    angle: Math.atan2(last.y - first.y, last.x - first.x),
  };
}

export class LineIntelligenceEngine {
  analyze(paths: VectorPath[], width: number, height: number): IntelligentLine[] {
    return paths.map((path) => classify(path, width, height, pathLength(path.points), pathStability(path.points)));
  }

  filterPaths(paths: VectorPath[], lines: IntelligentLine[], mode: "manual" | "auto") {
    if (mode === "manual") return paths;
    const kept = paths.filter((_, index) => lines[index]?.classification !== "WEAK_LINE");
    return kept.length ? kept : paths;
  }

  metrics(lines: IntelligentLine[], keptPaths: VectorPath[]): LineIntelligenceMetrics {
    const kept = keptPaths.length;
    return { detected: lines.length, kept, removed: Math.max(0, lines.length - kept), reductionPercent: lines.length ? Math.round((1 - kept / lines.length) * 100) : 0 };
  }
}

export const lineIntelligenceEngine = new LineIntelligenceEngine();
