"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Download, RotateCcw, Sparkles } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const styles = ["industrial", "cad_clean", "wood", "neon", "plastic"] as const;
type ModelStyle = (typeof styles)[number];

type SvgTo3DCadViewerProps = {
  svg: string;
  fileName?: string;
  unit?: string;
};

type BuildOptions = {
  depth: number;
  enhanced: boolean;
  cleanSvg: boolean;
  style: ModelStyle;
};

type ThreeState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  model: THREE.Group;
};

const styleLabels: Record<ModelStyle, string> = {
  industrial: "Industrial",
  cad_clean: "CAD Clean",
  wood: "Wood",
  neon: "Neon",
  plastic: "Plastic",
};

function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function baseName(fileName?: string) {
  return (fileName || "vectorcad-3d").replace(/\.[^.]+$/, "") || "vectorcad-3d";
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function cleanPathData(pathData: string) {
  const tokens = pathData.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const output: string[] = [];
  let index = 0;
  let command = "";
  let firstPoint: [number, number] | null = null;
  let lastPoint: [number, number] | null = null;
  const numberCounts: Record<string, number> = { M: 2, L: 2, T: 2, H: 1, V: 1, S: 4, Q: 4, C: 6, A: 7 };

  const samePoint = (a: [number, number] | null, b: [number, number]) => a && Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01;
  const rounded = (value: number) => Number(value.toFixed(3)).toString();

  while (index < tokens.length) {
    const token = tokens[index++];
    if (/^[a-zA-Z]$/.test(token)) command = token;
    else index--;

    if (!command) break;
    const upper = command.toUpperCase();
    if (upper === "Z") {
      output.push("Z");
      lastPoint = firstPoint;
      command = "";
      continue;
    }

    const count = numberCounts[upper];
    if (!count || index + count > tokens.length) break;
    const values = tokens.slice(index, index + count).map(Number);
    if (values.some((value) => !Number.isFinite(value))) break;
    index += count;

    if ((upper === "M" || upper === "L") && samePoint(lastPoint, [values[0], values[1]])) {
      command = upper === "M" ? "L" : command;
      continue;
    }

    if (upper === "M") {
      firstPoint = [values[0], values[1]];
      lastPoint = [values[0], values[1]];
      output.push(`${command}${rounded(values[0])} ${rounded(values[1])}`);
      command = command === "M" ? "L" : "l";
      continue;
    }

    if (upper === "L") lastPoint = [values[0], values[1]];
    if (upper === "C") lastPoint = [values[4], values[5]];
    if (upper === "Q") lastPoint = [values[2], values[3]];
    output.push(`${command}${values.map((value) => rounded(value)).join(" ")}`);
  }

  if (firstPoint && lastPoint && !samePoint(firstPoint, lastPoint) && !/z\s*$/i.test(output.join(""))) {
    output.push("Z");
  }

  return output.join(" ");
}

export function fixSvgGeometry(svg: string) {
  if (typeof window === "undefined") return svg;
  const parser = new DOMParser();
  const document = parser.parseFromString(svg, "image/svg+xml");
  const root = document.querySelector("svg");
  if (!root || document.querySelector("parsererror")) return svg;

  root.querySelectorAll("path").forEach((path) => {
    const data = path.getAttribute("d");
    if (!data) {
      path.remove();
      return;
    }
    const cleaned = cleanPathData(data);
    if (cleaned.length < 4) path.remove();
    else path.setAttribute("d", cleaned);
  });

  if (!root.getAttribute("viewBox")) {
    const width = Number.parseFloat(root.getAttribute("width") || "100");
    const height = Number.parseFloat(root.getAttribute("height") || "100");
    root.setAttribute("viewBox", `0 0 ${Number.isFinite(width) ? width : 100} ${Number.isFinite(height) ? height : 100}`);
  }

  root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  return new XMLSerializer().serializeToString(root);
}

function createWoodTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 128, 0);
  gradient.addColorStop(0, "#6b3f20");
  gradient.addColorStop(0.5, "#b67639");
  gradient.addColorStop(1, "#4b2a15");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) {
    ctx.strokeStyle = `rgba(48, 24, 10, ${0.18 + (y % 3) * 0.05})`;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y) * 3);
    ctx.bezierCurveTo(35, y - 6, 72, y + 10, 128, y + Math.cos(y) * 4);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function materialForStyle(style: ModelStyle) {
  if (style === "industrial") return new THREE.MeshStandardMaterial({ color: 0x24282b, metalness: 0.75, roughness: 0.82, side: THREE.DoubleSide });
  if (style === "cad_clean") return new THREE.MeshStandardMaterial({ color: 0xf7f8f5, metalness: 0.02, roughness: 0.38, side: THREE.DoubleSide });
  if (style === "wood") return new THREE.MeshStandardMaterial({ color: 0x9a6332, map: createWoodTexture() || undefined, metalness: 0.02, roughness: 0.68, side: THREE.DoubleSide });
  if (style === "neon") return new THREE.MeshPhongMaterial({ color: 0x4c7dff, emissive: 0x6b2dff, emissiveIntensity: 1.25, shininess: 92, side: THREE.DoubleSide });
  return new THREE.MeshStandardMaterial({ color: 0xe6e1d8, metalness: 0.01, roughness: 0.88, side: THREE.DoubleSide });
}

export function apply3DStyle(mesh: THREE.Mesh, style: ModelStyle) {
  const oldMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mesh.material = materialForStyle(style);
  mesh.userData.vectorCadStyle = style;
  oldMaterials.forEach((material) => material.dispose());
}

function applySceneStyle(scene: THREE.Scene, style: ModelStyle) {
  const settings: Record<ModelStyle, { background: number; ambient: number; directional: number; fill: number; grid: number }> = {
    industrial: { background: 0x1e2225, ambient: 0.45, directional: 1.55, fill: 0.25, grid: 0x3a4248 },
    cad_clean: { background: 0xf1f3f1, ambient: 0.82, directional: 1.05, fill: 0.18, grid: 0xc8d0cc },
    wood: { background: 0xf4eee6, ambient: 0.7, directional: 1.25, fill: 0.28, grid: 0xcab8a4 },
    neon: { background: 0x080916, ambient: 0.34, directional: 1.45, fill: 1.1, grid: 0x262a58 },
    plastic: { background: 0xe8e8e3, ambient: 0.76, directional: 1.18, fill: 0.22, grid: 0xc2c6bf },
  };
  const next = settings[style];
  scene.background = new THREE.Color(next.background);
  scene.traverse((object) => {
    if (object instanceof THREE.AmbientLight) object.intensity = next.ambient;
    if (object instanceof THREE.DirectionalLight && object.name === "key-light") object.intensity = next.directional;
    if (object instanceof THREE.DirectionalLight && object.name === "fill-light") object.intensity = next.fill;
    if (object instanceof THREE.GridHelper) object.material.color.setHex(next.grid);
  });
}

export function enhanceGeometryQuality(geometry: THREE.BufferGeometry) {
  geometry.deleteAttribute("normal");
  const optimized = mergeVertices(geometry, 0.0001);
  optimized.computeVertexNormals();
  optimized.normalizeNormals();
  optimized.computeBoundingBox();
  optimized.computeBoundingSphere();
  geometry.dispose();
  return optimized;
}

function buildModelFromSvg(svg: string, options: BuildOptions) {
  const loader = new SVGLoader();
  const data = loader.parse(options.cleanSvg ? fixSvgGeometry(svg) : svg);
  const geometries: THREE.BufferGeometry[] = [];
  const curveSegments = options.enhanced ? 24 : 12;
  const bevelSize = Math.max(options.depth * 0.025, 0.08);

  data.paths.forEach((path) => {
    const shapes = SVGLoader.createShapes(path);
    shapes.forEach((shape) => {
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: options.depth,
        steps: options.enhanced ? 3 : 1,
        curveSegments,
        bevelEnabled: options.enhanced,
        bevelThickness: Math.min(bevelSize, options.depth * 0.2),
        bevelSize,
        bevelSegments: options.enhanced ? 2 : 0,
      });
      geometry.scale(1, -1, 1);
      geometries.push(options.enhanced ? enhanceGeometryQuality(geometry) : geometry);
    });
  });

  const model = new THREE.Group();
  if (geometries.length === 0) return model;

  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());
  const finalGeometry = enhanceGeometryQuality(merged);
  finalGeometry.center();

  const material = new THREE.MeshStandardMaterial({
    color: 0xb7f34a,
    metalness: 0.08,
    roughness: 0.52,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(finalGeometry, material);
  mesh.name = options.enhanced ? "VectorCAD_Enhanced_Extrusion" : "VectorCAD_Extrusion";
  apply3DStyle(mesh, options.style);
  model.add(mesh);

  return model;
}

export function SvgTo3DCadViewer({ svg, fileName }: SvgTo3DCadViewerProps) {
  const mount = useRef<HTMLDivElement>(null);
  const state = useRef<ThreeState | null>(null);
  const frame = useRef<number | null>(null);
  const [height, setHeight] = useState(5);
  const [enhanced, setEnhanced] = useState(false);
  const [aiClean, setAiClean] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<ModelStyle>("cad_clean");
  const [appliedStyle, setAppliedStyle] = useState<ModelStyle>("cad_clean");
  const [qualityRun, setQualityRun] = useState(0);
  const [message, setMessage] = useState("Clique e arraste para girar. Use o scroll para aproximar.");

  const resetCamera = useCallback(() => {
    const current = state.current;
    if (!current) return;
    const box = new THREE.Box3().setFromObject(current.model);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 10);

    current.controls.target.set(0, 0, 0);
    current.camera.near = Math.max(radius / 1000, 0.01);
    current.camera.far = radius * 1000;
    current.camera.position.set(radius * 0.85, -radius * 1.1, radius * 1.15);
    current.camera.updateProjectionMatrix();
    current.controls.update();
  }, []);

  useEffect(() => {
    const host = mount.current;
    if (!host || !svg) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe7ebe8);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    directional.name = "key-light";
    directional.position.set(80, -120, 180);
    scene.add(directional);

    const fill = new THREE.DirectionalLight(0xb7f34a, 0.25);
    fill.name = "fill-light";
    fill.position.set(-90, 80, 90);
    scene.add(fill);

    const grid = new THREE.GridHelper(180, 18, 0xb8c2bd, 0xd4dbd7);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -height / 2 - 0.05;
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.75;
    controls.rotateSpeed = 0.72;
    controls.screenSpacePanning = true;

    const model = buildModelFromSvg(svg, { depth: height, enhanced, cleanSvg: aiClean, style: appliedStyle });
    scene.add(model);
    applySceneStyle(scene, appliedStyle);
    state.current = { scene, camera, renderer, controls, model };

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const viewHeight = Math.max(host.clientHeight, 1);
      renderer.setSize(width, viewHeight, false);
      camera.aspect = width / viewHeight;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    resetCamera();

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame.current = requestAnimationFrame(animate);
    };
    animate();

    const mesh = model.children[0] as THREE.Mesh | undefined;
    const count = mesh?.geometry.getAttribute("position")?.count || 0;
    setMessage(
      mesh
        ? `${aiClean ? "SVG limpo + " : ""}${enhanced ? "modelo 3D aprimorado" : "modelo 3D"} gerado com ${count.toLocaleString("pt-BR")} vertices otimizados.`
        : "Nenhuma forma fechada foi encontrada no SVG para extrusao.",
    );

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      observer.disconnect();
      controls.dispose();
      disposeObject(model);
      renderer.dispose();
      host.replaceChildren();
      state.current = null;
    };
  }, [aiClean, appliedStyle, enhanced, height, qualityRun, resetCamera, svg]);

  useEffect(() => {
    const current = state.current;
    const mesh = current?.model.children[0];
    if (!current || !(mesh instanceof THREE.Mesh)) return;
    apply3DStyle(mesh, appliedStyle);
    applySceneStyle(current.scene, appliedStyle);
    setMessage(`Estilo ${styleLabels[appliedStyle]} aplicado em tempo real.`);
  }, [appliedStyle]);

  const improveModel = () => {
    setEnhanced(true);
    setQualityRun((value) => value + 1);
    setMessage("Modo aprimorado aplicado: vertices duplicados removidos, normals recalculadas e bordas suavizadas.");
  };

  const fixModel = () => {
    setAiClean(true);
    setEnhanced(true);
    setQualityRun((value) => value + 1);
    setMessage("AI Clean aplicado: SVG normalizado, paths fechados e pontos duplicados reduzidos.");
  };

  const applyStyle = () => {
    setAppliedStyle(selectedStyle);
  };

  const exportStl = () => {
    const model = state.current?.model;
    if (!model || model.children.length === 0) return setMessage("Gere um modelo 3D antes de exportar STL.");
    const result = new STLExporter().parse(model, { binary: true });
    const blob = result instanceof ArrayBuffer
      ? new Blob([result], { type: "model/stl" })
      : new Blob([result], { type: "model/stl" });
    saveBlob(`${baseName(fileName)}.stl`, blob);
    setMessage("Arquivo STL compatível com impressão 3D/CAD gerado com sucesso.");
  };

  const exportGlb = () => {
    const model = state.current?.model;
    if (!model || model.children.length === 0) return setMessage("Gere um modelo 3D antes de exportar GLB.");
    new GLTFExporter().parse(
      model,
      (result) => {
        const blob = result instanceof ArrayBuffer
          ? new Blob([result], { type: "model/gltf-binary" })
          : new Blob([JSON.stringify(result)], { type: "model/gltf+json" });
        saveBlob(`${baseName(fileName)}.${result instanceof ArrayBuffer ? "glb" : "gltf"}`, blob);
        setMessage("Arquivo GLB gerado com sucesso para AutoCAD/Web.");
      },
      (error) => setMessage(`Nao foi possivel exportar GLB: ${error.message}`),
      { binary: true },
    );
  };

  return <section className="three-panel rounded-xl border border-[#324039] bg-[#111815] p-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#eef6f0]"><Box size={14} /> SvgTo3DCadViewer</h3>
        <p className="mt-1 text-[10px] text-[#87978f]">Extrusao CAD em mm a partir do SVG vetorizado.</p>
      </div>
      <button type="button" onClick={resetCamera} className="flex items-center gap-1 rounded border border-[#34413b] px-2 py-1.5 text-[9px] text-[#c8d4ce]"><RotateCcw size={12} /> Resetar câmera</button>
    </div>

    <label className="range-row mb-3 text-xs text-[#aab8b1]">
      <span>Altura (mm)</span>
      <b className="text-right text-[#e8efeb]">{height}</b>
      <input type="range" min={1} max={80} step={1} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
    </label>

    <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#26332e] bg-[#0d1411] px-3 py-2 text-xs text-[#bdc9c3]">
      <span>Modo qualidade alta</span>
      <button type="button" aria-pressed={enhanced} onClick={() => setEnhanced((value) => !value)} className={`h-5 w-9 rounded-full p-0.5 transition ${enhanced ? "bg-[#b7f34a]" : "bg-[#39443f]"}`}><span className={`block h-4 w-4 rounded-full bg-[#07100a] transition ${enhanced ? "translate-x-4" : ""}`} /></button>
    </label>

    <div ref={mount} className="three-viewport min-h-[300px] overflow-hidden rounded-lg border border-[#24332d]" />

    <div className="mt-3 grid gap-2">
      <div className="rounded-xl border border-[#2b3832] bg-[#0d1411] p-3">
        <div className="mb-3 text-[10px] font-black uppercase tracking-[.16em] text-[#b7f34a]">AI Enhance</div>
        <div className="grid gap-2">
          <button type="button" onClick={fixModel} className="flex items-center justify-center gap-2 rounded-lg border border-[#b7f34a]/60 bg-[#1b241c] py-2.5 text-xs font-black text-[#b7f34a]">✨ Fix Model (AI Clean)</button>
          <label className="text-[10px] uppercase tracking-wider text-[#77867e]">Estilo 3D</label>
          <select value={selectedStyle} onChange={(event) => setSelectedStyle(event.target.value as ModelStyle)} className="w-full text-xs">
            {styles.map((style) => <option key={style} value={style}>{styleLabels[style]}</option>)}
          </select>
          <button type="button" onClick={applyStyle} className="flex items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-xs font-black text-[#111713]">🎨 Apply Style</button>
        </div>
      </div>
      <button type="button" onClick={improveModel} className="flex items-center justify-center gap-2 rounded-lg border border-[#b7f34a]/60 bg-[#1b241c] py-2.5 text-xs font-black text-[#b7f34a]"><Sparkles size={14} /> Melhorar modelo 3D</button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={exportStl} className="flex items-center justify-center gap-2 rounded-lg bg-[#b7f34a] py-2.5 text-xs font-black text-[#0a120c]"><Download size={14} /> Exportar STL</button>
        <button type="button" onClick={exportGlb} className="flex items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-xs font-black text-[#111713]"><Download size={14} /> Exportar GLB</button>
      </div>
    </div>
    <p className="mt-2 text-[10px] leading-4 text-[#8f9d96]">{message}</p>
  </section>;
}

export const SvgToCad3DViewer = SvgTo3DCadViewer;
export const SvgTo3DViewer = SvgTo3DCadViewer;
