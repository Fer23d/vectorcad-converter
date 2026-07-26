import { routeDocumentGeometry, type RoutedExportGeometry } from "@/lib/exporters/export-entity-router";
import type { CadPoint } from "@/types/cad-geometry";
import type { VectorDocument } from "@/types/vector";

const n = (value: number) => Number(value.toFixed(3));

function pathData(points: CadPoint[], closed: boolean, curved?: boolean) {
  if (!points.length) return "";
  if (!curved || points.length < 3) return points.map((point, index) => `${index ? "L" : "M"}${n(point.x)} ${n(point.y)}`).join(" ") + (closed ? " Z" : "");
  let d = `M${n(points[0].x)} ${n(points[0].y)}`;
  const limit = closed ? points.length : points.length - 1;
  for (let index = 0; index < limit; index++) {
    const p0 = points[(index - 1 + points.length) % points.length];
    const p1 = points[index];
    const p2 = points[(index + 1) % points.length];
    const p3 = points[(index + 2) % points.length];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p2.x)} ${n(p2.y)}`;
  }
  return d + (closed ? " Z" : "");
}

function arcPath(center: CadPoint, radius: number, startAngle: number, endAngle: number) {
  const start = { x: center.x + Math.cos(startAngle) * radius, y: center.y + Math.sin(startAngle) * radius };
  const end = { x: center.x + Math.cos(endAngle) * radius, y: center.y + Math.sin(endAngle) * radius };
  const span = Math.abs(endAngle - startAngle);
  const largeArc = span % (Math.PI * 2) > Math.PI ? 1 : 0;
  const sweep = endAngle >= startAngle ? 1 : 0;
  return `M${n(start.x)} ${n(start.y)} A${n(radius)} ${n(radius)} 0 ${largeArc} ${sweep} ${n(end.x)} ${n(end.y)}`;
}

function layerId(layer: string, index: number) {
  return `${layer.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}-${index + 1}`;
}

function renderGeometry(item: RoutedExportGeometry, index: number) {
  if (item.kind === "path") {
    return `  <path id="${layerId(item.path.layer, index)}" data-layer="${item.path.layer}" d="${pathData(item.path.points, item.path.closed, item.path.curved)}" />`;
  }

  const { entity } = item;
  const id = layerId(entity.layer, index);
  switch (entity.type) {
    case "LINE": {
      const { start, end } = entity.coordinates;
      return `  <line id="${id}" data-layer="${entity.layer}" x1="${n(start.x)}" y1="${n(start.y)}" x2="${n(end.x)}" y2="${n(end.y)}" />`;
    }
    case "CIRCLE": {
      const { center, radius } = entity.coordinates;
      return `  <circle id="${id}" data-layer="${entity.layer}" cx="${n(center.x)}" cy="${n(center.y)}" r="${n(radius)}" />`;
    }
    case "ELLIPSE": {
      const { center, majorRadius, minorRadius, rotation } = entity.coordinates;
      return `  <ellipse id="${id}" data-layer="${entity.layer}" cx="${n(center.x)}" cy="${n(center.y)}" rx="${n(majorRadius)}" ry="${n(minorRadius)}" transform="rotate(${n(rotation * 180 / Math.PI)} ${n(center.x)} ${n(center.y)})" />`;
    }
    case "ARC":
      return `  <path id="${id}" data-layer="${entity.layer}" d="${arcPath(entity.coordinates.center, entity.coordinates.radius, entity.coordinates.startAngle, entity.coordinates.endAngle)}" />`;
    case "SPLINE":
      return `  <path id="${id}" data-layer="${entity.layer}" d="${pathData(entity.coordinates.fitPoints, Boolean(entity.coordinates.closed), true)}" />`;
    case "LWPOLYLINE":
      return `  <path id="${id}" data-layer="${entity.layer}" d="${pathData(entity.coordinates.points, entity.coordinates.closed, entity.metadata.curved === true)}" />`;
    case "POLYGON":
      return `  <path id="${id}" data-layer="${entity.layer}" d="${pathData(entity.coordinates.points, true)}" />`;
  }
}

export function generateSvg(doc: VectorDocument): string {
  const geometry = routeDocumentGeometry(doc);
  const paths = geometry.map(renderGeometry).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(doc.width)}${doc.unit}" height="${n(doc.height)}${doc.unit}" viewBox="0 0 ${n(doc.width)} ${n(doc.height)}">
<g fill="none" stroke="#000" stroke-width="${doc.unit === "px" ? 1 : 0.2}" vector-effect="non-scaling-stroke">
${paths}
</g>
</svg>`;
}
