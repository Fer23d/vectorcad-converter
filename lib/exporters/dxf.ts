import Drawing from "dxf-writer";
import type { AiTextElement } from "@/lib/ai/vectorcad-ai";
import { routeDocumentGeometry, routedGeometryBoundsPoints, standardCadLayers, type RoutedExportGeometry } from "@/lib/exporters/export-entity-router";
import type { CadPoint } from "@/types/cad-geometry";
import type { Point, Unit, VectorDocument } from "@/types/vector";

type ExtendedDrawing = Drawing & {
  drawSpline: (controlPoints: Array<[number, number]>, degree?: number, knots?: number[] | null, weights?: number[] | null, fitPoints?: Array<[number, number]>) => Drawing;
  drawEllipse: (x: number, y: number, majorAxisX: number, majorAxisY: number, axisRatio: number, startAngle?: number, endAngle?: number) => Drawing;
};

const writerUnit: Record<Unit, "Unitless" | "Millimeters" | "Centimeters"> = {
  px: "Unitless",
  mm: "Millimeters",
  cm: "Centimeters",
};

const layerColors: Record<string, number> = {
  CONTOURS: Drawing.ACI.WHITE,
  DETAILS: Drawing.ACI.GREEN,
  GUIDES: Drawing.ACI.CYAN,
  TEXTOS: Drawing.ACI.YELLOW,
  GEOMETRY: Drawing.ACI.WHITE,
  WALLS: Drawing.ACI.GREEN,
  DOORS: Drawing.ACI.YELLOW,
  WINDOWS: Drawing.ACI.CYAN,
  CENTERLINES: Drawing.ACI.BLUE,
  DIMENSIONS: Drawing.ACI.RED,
};

function finitePoint(point: Point) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function samePoint(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

function validPoints(points: Point[], closed: boolean) {
  const result = points.filter(finitePoint);
  if (closed && result.length > 1 && samePoint(result[0], result[result.length - 1])) result.pop();
  return result.filter((point, index) => index === 0 || !samePoint(point, result[index - 1]));
}

function validTextElements(texts: AiTextElement[]) {
  return texts.filter((text) => ["TEXT", "LABEL", "TITLE", "ANNOTATION"].includes(text.type) && text.value.trim().length > 0 && Number.isFinite(text.position.x) && Number.isFinite(text.position.y));
}

function textHeight(text: AiTextElement, doc: VectorDocument) {
  const sourceHeight = Math.max(doc.sourceHeight, 1);
  const scaleY = doc.height / sourceHeight;
  const rawHeight = text.boundingBox.height * scaleY;
  const minimum = doc.unit === "cm" ? .05 : .5;
  return Math.max(minimum, Math.min(doc.height * .2, rawHeight || minimum));
}

function bounds(points: Point[], height: number) {
  const dxfPoints = points.map(point => ({ x: point.x, y: height - point.y }));
  const minX = Math.min(...dxfPoints.map(point => point.x));
  const minY = Math.min(...dxfPoints.map(point => point.y));
  const maxX = Math.max(...dxfPoints.map(point => point.x));
  const maxY = Math.max(...dxfPoints.map(point => point.y));
  return { minX, minY, maxX, maxY, width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) };
}

function normalizedDegrees(radians: number) {
  const degrees = radians * 180 / Math.PI;
  return ((degrees % 360) + 360) % 360;
}

function dxfPoint(point: CadPoint, height: number): [number, number] {
  return [point.x, height - point.y];
}

function addLayer(drawing: Drawing, knownLayers: Set<string>, layer: string) {
  if (knownLayers.has(layer)) return;
  drawing.addLayer(layer, layerColors[layer] ?? Drawing.ACI.WHITE, "CONTINUOUS");
  knownLayers.add(layer);
}

function writeGeometry(drawing: ExtendedDrawing, item: RoutedExportGeometry, height: number) {
  if (item.kind === "path") {
    const points = validPoints(item.path.points, item.path.closed);
    drawing.drawPolyline(points.map(point => dxfPoint(point, height)), item.path.closed);
    return;
  }

  const entity = item.entity;
  switch (entity.type) {
    case "LINE": {
      const [startX, startY] = dxfPoint(entity.coordinates.start, height);
      const [endX, endY] = dxfPoint(entity.coordinates.end, height);
      drawing.drawLine(startX, startY, endX, endY);
      return;
    }
    case "CIRCLE": {
      const [x, y] = dxfPoint(entity.coordinates.center, height);
      drawing.drawCircle(x, y, entity.coordinates.radius);
      return;
    }
    case "ARC": {
      const [x, y] = dxfPoint(entity.coordinates.center, height);
      // DXF is Y-up while the document is Y-down, so the reflected arc swaps its bounds.
      drawing.drawArc(x, y, entity.coordinates.radius, normalizedDegrees(-entity.coordinates.endAngle), normalizedDegrees(-entity.coordinates.startAngle));
      return;
    }
    case "ELLIPSE": {
      const { center, majorRadius, minorRadius, rotation } = entity.coordinates;
      const [x, y] = dxfPoint(center, height);
      drawing.drawEllipse(x, y, Math.cos(rotation) * majorRadius, -Math.sin(rotation) * majorRadius, minorRadius / majorRadius);
      return;
    }
    case "SPLINE": {
      const fitPoints = validPoints(entity.coordinates.fitPoints, false).map(point => dxfPoint(point, height));
      const controls = validPoints(entity.coordinates.controlPoints || entity.coordinates.fitPoints, false).map(point => dxfPoint(point, height));
      const degree = Math.max(1, Math.min(entity.coordinates.degree ?? 3, controls.length - 1));
      drawing.drawSpline(controls, degree, null, null, fitPoints);
      return;
    }
    case "LWPOLYLINE":
      drawing.drawPolyline(validPoints(entity.coordinates.points, entity.coordinates.closed).map(point => dxfPoint(point, height)), entity.coordinates.closed);
      return;
    case "POLYGON":
      drawing.drawPolyline(validPoints(entity.coordinates.points, true).map(point => dxfPoint(point, height)), true);
      return;
  }
}

function logGeometryRoute(geometry: RoutedExportGeometry[]) {
  const entityCount = geometry.filter(item => item.kind === "entity").length;
  const legacyCount = geometry.length - entityCount;
  if (entityCount && legacyCount) console.info("[vetorcad][export] using entities and legacy paths");
  else if (entityCount) console.info("[vetorcad][export] using entities");
  else console.info("[vetorcad][export] using legacy paths");
}

export function generateDxf(doc: VectorDocument, texts: AiTextElement[] = []): string {
  const height = Number.isFinite(doc.height) && doc.height > 0 ? doc.height : 1;
  const geometry = routeDocumentGeometry(doc);
  logGeometryRoute(geometry);
  const drawing = new Drawing() as ExtendedDrawing;
  drawing.setUnits(writerUnit[doc.unit]);
  drawing.header("TILEMODE", [[70, 1]]);
  drawing.header("MEASUREMENT", [[70, doc.unit === "px" ? 0 : 1]]);
  const knownLayers = new Set<string>();
  for (const layer of ["CONTOURS", "DETAILS", "GUIDES", "TEXTOS", ...standardCadLayers]) addLayer(drawing, knownLayers, layer);

  for (const item of geometry) {
    const layer = item.kind === "entity" ? item.entity.layer : item.path.layer;
    addLayer(drawing, knownLayers, layer);
    drawing.setActiveLayer(layer);
    writeGeometry(drawing, item, height);
  }

  const sourceWidth = Math.max(doc.sourceWidth, 1);
  const sourceHeight = Math.max(doc.sourceHeight, 1);
  const textScaleX = doc.coordinateSystem ? 1 : doc.width / sourceWidth;
  const textScaleY = doc.coordinateSystem ? 1 : doc.height / sourceHeight;
  drawing.setActiveLayer("TEXTOS");
  for (const text of validTextElements(texts)) {
    const x = text.position.x * textScaleX;
    const y = doc.height - text.position.y * textScaleY;
    const rotation = Number.isFinite(text.rotation) ? text.rotation : 0;
    drawing.drawText(x, y, textHeight(text, doc), rotation, text.value.replace(/[\r\n]+/g, " "), "left", "baseline");
  }

  const geometryPoints = geometry.flatMap(routedGeometryBoundsPoints);
  if (geometryPoints.length) {
    const box = bounds(geometryPoints, height);
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

export function countDxfEntities(doc: VectorDocument, texts: AiTextElement[] = []) {
  return routeDocumentGeometry(doc).length + validTextElements(texts).length;
}
