import Drawing from "dxf-writer";
import type { Point, Unit, VectorDocument, VectorPath } from "@/types/vector";

const writerUnit: Record<Unit, "Unitless" | "Millimeters" | "Centimeters"> = {
  px: "Unitless",
  mm: "Millimeters",
  cm: "Centimeters",
};

function finitePoint(point: Point) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function samePoint(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

function validPoints(path: VectorPath) {
  const points = path.points.filter(finitePoint);
  if (path.closed && points.length > 1 && samePoint(points[0], points[points.length - 1])) points.pop();
  return points.filter((point, index) => index === 0 || !samePoint(point, points[index - 1]));
}

function validPaths(doc: VectorDocument) {
  return doc.paths
    .map(path => ({ path, points: validPoints(path) }))
    .filter(item => item.points.length >= (item.path.closed ? 3 : 2));
}

function bounds(paths: ReturnType<typeof validPaths>, height: number) {
  const points = paths.flatMap(item => item.points.map(point => ({ x: point.x, y: height - point.y })));
  const minX = Math.min(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxX = Math.max(...points.map(point => point.x));
  const maxY = Math.max(...points.map(point => point.y));
  return { minX, minY, maxX, maxY, width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) };
}

export function generateDxf(doc: VectorDocument): string {
  const height = Number.isFinite(doc.height) && doc.height > 0 ? doc.height : 1;
  const paths = validPaths(doc);
  const drawing = new Drawing();
  drawing.setUnits(writerUnit[doc.unit]);
  drawing.header("TILEMODE", [[70, 1]]);
  drawing.header("MEASUREMENT", [[70, doc.unit === "px" ? 0 : 1]]);
  drawing.addLayer("CONTOURS", Drawing.ACI.WHITE, "CONTINUOUS");
  drawing.addLayer("DETAILS", Drawing.ACI.GREEN, "CONTINUOUS");
  drawing.addLayer("GUIDES", Drawing.ACI.CYAN, "CONTINUOUS");

  for (const { path, points } of paths) {
    drawing.setActiveLayer(path.layer);
    drawing.drawPolyline(points.map(point => [point.x, height - point.y]), path.closed);
  }

  if (paths.length) {
    const box = bounds(paths, height);
    const centerX = (box.minX + box.maxX) / 2;
    const centerY = (box.minY + box.maxY) / 2;
    drawing.header("EXTMIN", [[10, box.minX], [20, box.minY], [30, 0]]);
    drawing.header("EXTMAX", [[10, box.maxX], [20, box.maxY], [30, 0]]);
    drawing.header("LIMMIN", [[10, box.minX], [20, box.minY]]);
    drawing.header("LIMMAX", [[10, box.maxX], [20, box.maxY]]);
    drawing.header("VIEWCTR", [[10, centerX], [20, centerY]]);
    drawing.header("VIEWSIZE", [[40, Math.max(box.height * 1.15, box.width * 1.15 / 1.777777)]]);
  }

  return drawing.toDxfString().replace(/\r?\n/g, "\r\n");
}

export function countDxfEntities(doc: VectorDocument) {
  return validPaths(doc).length;
}
