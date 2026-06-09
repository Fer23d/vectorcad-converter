import type { VectorDocument } from "@/types/vector";

const n = (v: number) => Number(v.toFixed(3));

function pathData(points: VectorDocument["paths"][number]["points"], closed: boolean, curved?: boolean) {
  if (!points.length) return "";
  if (!curved || points.length < 3) return points.map((p, i) => `${i ? "L" : "M"}${n(p.x)} ${n(p.y)}`).join(" ") + (closed ? " Z" : "");
  let d = `M${n(points[0].x)} ${n(points[0].y)}`;
  const limit = closed ? points.length : points.length - 1;
  for (let i = 0; i < limit; i++) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i], p2 = points[(i + 1) % points.length], p3 = points[(i + 2) % points.length];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p2.x)} ${n(p2.y)}`;
  }
  return d + (closed ? " Z" : "");
}

export function generateSvg(doc: VectorDocument): string {
  const paths = doc.paths.map((path, i) => {
    const d = pathData(path.points, path.closed, path.curved);
    return `  <path id="${path.layer.toLowerCase()}-${i + 1}" d="${d}" />`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(doc.width)}${doc.unit}" height="${n(doc.height)}${doc.unit}" viewBox="0 0 ${n(doc.width)} ${n(doc.height)}">
<g fill="none" stroke="#000" stroke-width="${doc.unit === "px" ? 1 : 0.2}" vector-effect="non-scaling-stroke">
${paths}
</g>
</svg>`;
}
