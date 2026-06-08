import type { VectorDocument } from "@/types/vector";

const n = (v: number) => Number(v.toFixed(3));

export function generateSvg(doc: VectorDocument): string {
  const paths = doc.paths.map((path, i) => {
    const d = path.points.map((p, j) => `${j ? "L" : "M"}${n(p.x)} ${n(p.y)}`).join(" ") + (path.closed ? " Z" : "");
    return `  <path id="${path.layer.toLowerCase()}-${i + 1}" d="${d}" />`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(doc.width)}${doc.unit}" height="${n(doc.height)}${doc.unit}" viewBox="0 0 ${n(doc.width)} ${n(doc.height)}">
<g fill="none" stroke="#000" stroke-width="${doc.unit === "px" ? 1 : 0.2}" vector-effect="non-scaling-stroke">
${paths}
</g>
</svg>`;
}
