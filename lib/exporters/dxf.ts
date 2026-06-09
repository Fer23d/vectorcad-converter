import type { Point, Unit, VectorDocument, VectorPath } from "@/types/vector";

const CRLF = "\r\n";
const pair = (code: number | string, value: number | string) => `${code}${CRLF}${value}${CRLF}`;
const unitCode: Record<Unit, number> = { px: 0, mm: 4, cm: 5 };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; centerX: number; centerY: number };

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

function drawingBounds(paths: Array<{ path: VectorPath; points: Point[] }>, fallbackWidth: number, fallbackHeight: number): Bounds {
  const points = paths.flatMap(item => item.points.map(point => ({ x: point.x, y: fallbackHeight - point.y })));
  if (!points.length) return { minX: 0, minY: 0, maxX: fallbackWidth, maxY: fallbackHeight, width: fallbackWidth, height: fallbackHeight, centerX: fallbackWidth / 2, centerY: fallbackHeight / 2 };
  const minX = Math.min(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxX = Math.max(...points.map(point => point.x));
  const maxY = Math.max(...points.map(point => point.y));
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  return { minX, minY, maxX, maxY, width, height, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

function linetypeTable() {
  return pair(0, "TABLE") + pair(2, "LTYPE") + pair(5, 1) + pair(100, "AcDbSymbolTable") + pair(70, 1)
    + pair(0, "LTYPE") + pair(5, 3) + pair(100, "AcDbSymbolTableRecord") + pair(100, "AcDbLinetypeTableRecord")
    + pair(2, "CONTINUOUS") + pair(70, 0) + pair(3, "Solid line") + pair(72, 65) + pair(73, 0) + pair(40, 0)
    + pair(0, "ENDTAB");
}

function viewportTable(bounds: Bounds) {
  const margin = 1.15;
  const viewHeight = Math.max(bounds.height * margin, bounds.width * margin / 1.777777);
  return pair(0, "TABLE") + pair(2, "VPORT") + pair(5, 8) + pair(100, "AcDbSymbolTable") + pair(70, 1)
    + pair(0, "VPORT") + pair(5, 9) + pair(100, "AcDbSymbolTableRecord") + pair(100, "AcDbViewportTableRecord")
    + pair(2, "*ACTIVE") + pair(70, 0) + pair(10, 0) + pair(20, 0) + pair(11, 1) + pair(21, 1)
    + pair(12, bounds.centerX) + pair(22, bounds.centerY) + pair(13, 0) + pair(23, 0) + pair(14, 10) + pair(24, 10)
    + pair(15, 10) + pair(25, 10) + pair(16, 0) + pair(26, 0) + pair(36, 1) + pair(17, 0) + pair(27, 0) + pair(37, 0)
    + pair(40, viewHeight) + pair(41, 1.777777) + pair(42, 50) + pair(43, 0) + pair(44, 0) + pair(50, 0) + pair(51, 0)
    + pair(71, 0) + pair(72, 100) + pair(73, 1) + pair(74, 3) + pair(75, 0) + pair(76, 0) + pair(77, 0) + pair(78, 0)
    + pair(0, "ENDTAB");
}

function layerTable() {
  let out = pair(0, "TABLE") + pair(2, "LAYER") + pair(5, 2) + pair(100, "AcDbSymbolTable") + pair(70, 4);
  for (const [handle, name, color] of [["F", "0", 7], ["10", "CONTOURS", 7], ["11", "DETAILS", 3], ["12", "GUIDES", 8]] as const) {
    out += pair(0, "LAYER") + pair(5, handle) + pair(100, "AcDbSymbolTableRecord") + pair(100, "AcDbLayerTableRecord");
    out += pair(2, name) + pair(70, 0) + pair(62, color) + pair(6, "CONTINUOUS");
  }
  return out + pair(0, "ENDTAB");
}

function polyline(path: VectorPath, points: Point[], height: number, handle: string) {
  let out = pair(0, "LWPOLYLINE") + pair(5, handle) + pair(100, "AcDbEntity") + pair(8, path.layer);
  out += pair(100, "AcDbPolyline") + pair(90, points.length) + pair(70, path.closed ? 1 : 0) + pair(43, 0);
  for (const point of points) out += pair(10, point.x.toFixed(6)) + pair(20, (height - point.y).toFixed(6));
  return out + pair(210, 0) + pair(220, 0) + pair(230, 1);
}

export function generateDxf(doc: VectorDocument): string {
  const width = Number.isFinite(doc.width) && doc.width > 0 ? doc.width : 1;
  const height = Number.isFinite(doc.height) && doc.height > 0 ? doc.height : 1;
  const paths = doc.paths.map(path => ({ path, points: validPoints(path) })).filter(item => item.points.length >= (item.path.closed ? 3 : 2));
  const bounds = drawingBounds(paths, width, height);
  const viewHeight = Math.max(bounds.height * 1.15, bounds.width * 1.15 / 1.777777);

  let out = pair(0, "SECTION") + pair(2, "HEADER");
  out += pair(9, "$ACADVER") + pair(1, "AC1015");
  out += pair(9, "$HANDSEED") + pair(5, (512 + paths.length).toString(16).toUpperCase());
  out += pair(9, "$INSUNITS") + pair(70, unitCode[doc.unit]);
  out += pair(9, "$MEASUREMENT") + pair(70, doc.unit === "px" ? 0 : 1);
  out += pair(9, "$TILEMODE") + pair(70, 1);
  out += pair(9, "$EXTMIN") + pair(10, bounds.minX) + pair(20, bounds.minY) + pair(30, 0);
  out += pair(9, "$EXTMAX") + pair(10, bounds.maxX) + pair(20, bounds.maxY) + pair(30, 0);
  out += pair(9, "$LIMMIN") + pair(10, bounds.minX) + pair(20, bounds.minY);
  out += pair(9, "$LIMMAX") + pair(10, bounds.maxX) + pair(20, bounds.maxY);
  out += pair(9, "$VIEWCTR") + pair(10, bounds.centerX) + pair(20, bounds.centerY);
  out += pair(9, "$VIEWSIZE") + pair(40, viewHeight);
  out += pair(0, "ENDSEC");

  out += pair(0, "SECTION") + pair(2, "TABLES") + viewportTable(bounds) + linetypeTable() + layerTable() + pair(0, "ENDSEC");
  out += pair(0, "SECTION") + pair(2, "ENTITIES");
  paths.forEach(({ path, points }, index) => { out += polyline(path, points, height, (256 + index).toString(16).toUpperCase()); });
  return out + pair(0, "ENDSEC") + pair(0, "EOF");
}

export function countDxfEntities(doc: VectorDocument) {
  return doc.paths.filter(path => validPoints(path).length >= (path.closed ? 3 : 2)).length;
}
