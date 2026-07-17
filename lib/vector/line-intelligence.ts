import type { Point, VectorPath } from "@/types/vector";

export type LineClassification = "STRONG_LINE" | "MEDIUM_LINE" | "WEAK_LINE";
export type LineIntent = "MAIN_LINE" | "SECONDARY_LINE" | "DUPLICATE_EDGE" | "NOISE";

export type IntelligentLine = {
  id: string;
  type: "LINE" | "POLYLINE" | "CURVE";
  points: Point[];
  confidence: number;
  classification: LineClassification;
  intent: LineIntent;
  length: number;
  angle: number;
};

export type LineIntelligenceMetrics = {
  pathsReceived: number;
  detected: number;
  strong: number;
  medium: number;
  weak: number;
  kept: number;
  removed: number;
  unified: number;
  beforeSegments: number;
  afterSegments: number;
  improvementPercent: number;
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
  const intent: LineIntent = classification === "WEAK_LINE" ? "NOISE" : classification === "STRONG_LINE" ? "MAIN_LINE" : "SECONDARY_LINE";
  return {
    id: `line-${path.layer}-${Math.round(first.x)}-${Math.round(first.y)}-${path.points.length}`,
    type: path.curved ? "CURVE" : path.closed || path.points.length > 2 ? "POLYLINE" : "LINE",
    points: path.points.map(point => ({ ...point })),
    confidence,
    classification,
    intent,
    length,
    angle: Math.atan2(last.y - first.y, last.x - first.x),
  };
}

function lineEnds(line: IntelligentLine) {
  return { start: line.points[0], end: line.points[line.points.length - 1] };
}

function pointLineDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = Math.hypot(dx, dy) || 1;
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / denominator;
}

function projection(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy || 1;
  return ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator;
}

function isParallelDuplicate(left: IntelligentLine, right: IntelligentLine, diagonal: number) {
  if (left.type !== "LINE" || right.type !== "LINE" || left.points.length < 2 || right.points.length < 2) return false;
  const leftEnds = lineEnds(left), rightEnds = lineEnds(right);
  const angle = angleDelta(left.angle, right.angle);
  const parallel = angle < Math.PI / 18 || Math.abs(angle - Math.PI) < Math.PI / 18;
  if (!parallel) return false;
  const gap = Math.min(pointLineDistance(rightEnds.start, leftEnds.start, leftEnds.end), pointLineDistance(rightEnds.end, leftEnds.start, leftEnds.end));
  const maxGap = Math.max(2, diagonal * .006);
  if (gap > maxGap) return false;
  const leftProjection = [projection(rightEnds.start, leftEnds.start, leftEnds.end), projection(rightEnds.end, leftEnds.start, leftEnds.end)].sort((a, b) => a - b);
  const overlap = Math.max(0, Math.min(1, leftProjection[1]) - Math.max(0, leftProjection[0]));
  return overlap >= .55 && Math.min(left.length, right.length) / Math.max(left.length, right.length) >= .55;
}

export class LineIntelligenceEngine {
  analyze(paths: VectorPath[], width: number, height: number): IntelligentLine[] {
    return paths.map((path) => classify(path, width, height, pathLength(path.points), pathStability(path.points)));
  }

  selectPaths(paths: VectorPath[], lines: IntelligentLine[], mode: "manual" | "auto", width = 1, height = 1) {
    const diagonal = Math.hypot(width, height) || 1;
    const selected = paths.map((path, index) => ({ path, line: lines[index] })).filter(({ line }) => mode === "manual" || line?.classification !== "WEAK_LINE");
    const unified = new Set<number>();
    const kept = selected.filter((candidate, index) => {
      if (mode === "manual") return true;
      const duplicate = selected.slice(0, index).find(previous => {
        const previousIndex = selected.indexOf(previous);
        if (unified.has(previousIndex)) return false;
        return isParallelDuplicate(previous.line, candidate.line, diagonal);
      });
      if (!duplicate) return true;
      const candidateIndex = selected.indexOf(candidate);
      unified.add(candidateIndex);
      candidate.line.intent = "DUPLICATE_EDGE";
      return false;
    });
    const pathsToKeep = kept.length ? kept.map(item => item.path) : paths;
    return { paths: pathsToKeep, unified: unified.size, removedWeak: Math.max(0, paths.length - selected.length) };
  }

  filterPaths(paths: VectorPath[], lines: IntelligentLine[], mode: "manual" | "auto", width = 1, height = 1) {
    return this.selectPaths(paths, lines, mode, width, height).paths;
  }

  score(lines: IntelligentLine[], paths: VectorPath[]) {
    const strong = lines.filter(line => line.classification === "STRONG_LINE").length;
    const medium = lines.filter(line => line.classification === "MEDIUM_LINE").length;
    const weak = lines.filter(line => line.classification === "WEAK_LINE").length;
    const closed = paths.filter(path => path.closed).length;
    const segments = paths.reduce((total, path) => total + Math.max(0, path.points.length - 1), 0);
    return strong * 3 + medium * 1.25 + closed * .5 + Math.min(segments, 2000) / 2000 - weak * .35;
  }

  metrics(lines: IntelligentLine[], keptPaths: VectorPath[], unified = 0): LineIntelligenceMetrics {
    const strong = lines.filter(line => line.classification === "STRONG_LINE").length;
    const medium = lines.filter(line => line.classification === "MEDIUM_LINE").length;
    const weak = lines.filter(line => line.classification === "WEAK_LINE").length;
    const beforeSegments = lines.reduce((total, line) => total + Math.max(0, line.points.length - 1), 0);
    const afterSegments = keptPaths.reduce((total, path) => total + Math.max(0, path.points.length - 1), 0);
    const kept = keptPaths.length;
    return {
      pathsReceived: lines.length,
      detected: lines.length,
      strong,
      medium,
      weak,
      kept,
      removed: Math.max(0, lines.length - kept),
      unified,
      beforeSegments,
      afterSegments,
      improvementPercent: beforeSegments ? Math.max(0, Math.round((1 - afterSegments / beforeSegments) * 100)) : 0,
      reductionPercent: lines.length ? Math.round((1 - kept / lines.length) * 100) : 0,
    };
  }
}

export const lineIntelligenceEngine = new LineIntelligenceEngine();
