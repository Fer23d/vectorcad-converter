import type { Point, Unit, VectorDocument, VectorPath } from "@/types/vector";

const CRLF = "\r\n";
const pair = (code: number | string, value: number | string) => `${code}${CRLF}${value}${CRLF}`;
const unitCode: Record<Unit, number> = { px: 0, mm: 4, cm: 5 };

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

function layerTable() {
  let out = pair(0, "TABLE") + pair(2, "LAYER") + pair(5, 2) + pair(100, "AcDbSymbolTable") + pair(70, 3);
  for (const [handle, name, color] of [["10", "CONTOURS", 7], ["11", "DETAILS", 3], ["12", "GUIDES", 8]] as const) {
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

  let out = pair(0, "SECTION") + pair(2, "HEADER");
  out += pair(9, "$ACADVER") + pair(1, "AC1015");
  out += pair(9, "$INSUNITS") + pair(70, unitCode[doc.unit]);
  out += pair(9, "$MEASUREMENT") + pair(70, doc.unit === "px" ? 0 : 1);
  out += pair(9, "$EXTMIN") + pair(10, 0) + pair(20, 0) + pair(30, 0);
  out += pair(9, "$EXTMAX") + pair(10, width) + pair(20, height) + pair(30, 0);
  out += pair(0, "ENDSEC");

  out += pair(0, "SECTION") + pair(2, "TABLES") + layerTable() + pair(0, "ENDSEC");
  out += pair(0, "SECTION") + pair(2, "ENTITIES");
  paths.forEach(({ path, points }, index) => { out += polyline(path, points, height, (256 + index).toString(16).toUpperCase()); });
  return out + pair(0, "ENDSEC") + pair(0, "EOF");
}

export function countDxfEntities(doc: VectorDocument) {
  return doc.paths.filter(path => validPoints(path).length >= (path.closed ? 3 : 2)).length;
}
