import { SvgTo3DCadViewer } from "@/components/SvgTo3DCadViewer";
import { generateSvg } from "@/lib/exporters/svg";
import type { VectorDocument } from "@/types/vector";

const diagnosticDocument: VectorDocument = {
  width: 160,
  height: 120,
  sourceWidth: 160,
  sourceHeight: 120,
  unit: "mm",
  paths: [],
  entities: [
    { id: "diagnostic-line", type: "LINE", layer: "GEOMETRY", source: "manual", confidence: 1, coordinates: { start: { x: 10, y: 15 }, end: { x: 145, y: 15 } }, metadata: {} },
    { id: "diagnostic-circle", type: "CIRCLE", layer: "GEOMETRY", source: "manual", confidence: 1, coordinates: { center: { x: 45, y: 70 }, radius: 22 }, metadata: {} },
    { id: "diagnostic-square", type: "POLYGON", layer: "GEOMETRY", source: "manual", confidence: 1, coordinates: { points: [{ x: 95, y: 45 }, { x: 140, y: 45 }, { x: 140, y: 90 }, { x: 95, y: 90 }] }, metadata: {} },
  ],
  coordinateSystem: { id: "diagnostic-mm", origin: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, unit: "millimeter", precision: 6, createdFrom: "manual" },
};

export default function ThreeDiagnosticPage() {
  return <main className="min-h-screen bg-[#080c0b] p-4 text-[#e8efeb] md:p-7">
    <h1 className="mb-2 text-lg font-black text-[#b7f34a]">Diagnóstico Three.js</h1>
    <p className="mb-5 text-xs text-[#9caaa3]">Documento fixo: linha, círculo e quadrado. Não consulta autenticação ou Supabase.</p>
    <SvgTo3DCadViewer document={diagnosticDocument} svg={generateSvg(diagnosticDocument)} fileName="teste-3d" unit="mm" />
  </main>;
}
