"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Download, RotateCcw, Sparkles } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type SvgToCad3DViewerProps = {
  svg: string;
  fileName?: string;
  unit?: string;
};

type BuildOptions = {
  depth: number;
  enhanced: boolean;
};

type ThreeState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  model: THREE.Group;
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

export function enhanceMeshQuality(geometry: THREE.BufferGeometry) {
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
  const data = loader.parse(svg);
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
      geometries.push(options.enhanced ? enhanceMeshQuality(geometry) : geometry);
    });
  });

  const model = new THREE.Group();
  if (geometries.length === 0) return model;

  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());
  const finalGeometry = enhanceMeshQuality(merged);
  finalGeometry.center();

  const material = new THREE.MeshStandardMaterial({
    color: 0xb7f34a,
    metalness: 0.08,
    roughness: 0.52,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(finalGeometry, material);
  mesh.name = options.enhanced ? "VectorCAD_Enhanced_Extrusion" : "VectorCAD_Extrusion";
  model.add(mesh);

  return model;
}

export function SvgToCad3DViewer({ svg, fileName, unit = "mm" }: SvgToCad3DViewerProps) {
  const mount = useRef<HTMLDivElement>(null);
  const state = useRef<ThreeState | null>(null);
  const frame = useRef<number | null>(null);
  const [height, setHeight] = useState(5);
  const [enhanced, setEnhanced] = useState(false);
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
    directional.position.set(80, -120, 180);
    scene.add(directional);

    const fill = new THREE.DirectionalLight(0xb7f34a, 0.25);
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

    const model = buildModelFromSvg(svg, { depth: height, enhanced });
    scene.add(model);
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
        ? `${enhanced ? "Modelo 3D aprimorado" : "Modelo 3D"} gerado com ${count.toLocaleString("pt-BR")} vertices otimizados.`
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
  }, [enhanced, height, qualityRun, resetCamera, svg]);

  const improveModel = () => {
    setEnhanced(true);
    setQualityRun((value) => value + 1);
    setMessage("Modo aprimorado aplicado: vertices duplicados removidos, normals recalculadas e bordas suavizadas.");
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
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#eef6f0]"><Box size={14} /> SvgToCad3DViewer</h3>
        <p className="mt-1 text-[10px] text-[#87978f]">Extrusao CAD em mm a partir do SVG vetorizado.</p>
      </div>
      <button type="button" onClick={resetCamera} className="flex items-center gap-1 rounded border border-[#34413b] px-2 py-1.5 text-[9px] text-[#c8d4ce]"><RotateCcw size={12} /> Reset View</button>
    </div>

    <label className="range-row mb-3 text-xs text-[#aab8b1]">
      <span>Altura da extrusao ({unit})</span>
      <b className="text-right text-[#e8efeb]">{height}</b>
      <input type="range" min={1} max={80} step={1} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
    </label>

    <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#26332e] bg-[#0d1411] px-3 py-2 text-xs text-[#bdc9c3]">
      <span>Modo aprimorado (qualidade alta)</span>
      <button type="button" aria-pressed={enhanced} onClick={() => setEnhanced((value) => !value)} className={`h-5 w-9 rounded-full p-0.5 transition ${enhanced ? "bg-[#b7f34a]" : "bg-[#39443f]"}`}><span className={`block h-4 w-4 rounded-full bg-[#07100a] transition ${enhanced ? "translate-x-4" : ""}`} /></button>
    </label>

    <div ref={mount} className="three-viewport min-h-[300px] overflow-hidden rounded-lg border border-[#24332d]" />

    <div className="mt-3 grid gap-2">
      <button type="button" onClick={improveModel} className="flex items-center justify-center gap-2 rounded-lg border border-[#b7f34a]/60 bg-[#1b241c] py-2.5 text-xs font-black text-[#b7f34a]"><Sparkles size={14} /> Melhorar modelo 3D</button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={exportStl} className="flex items-center justify-center gap-2 rounded-lg bg-[#b7f34a] py-2.5 text-xs font-black text-[#0a120c]"><Download size={14} /> Exportar STL</button>
        <button type="button" onClick={exportGlb} className="flex items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-xs font-black text-[#111713]"><Download size={14} /> Exportar GLB</button>
      </div>
    </div>
    <p className="mt-2 text-[10px] leading-4 text-[#8f9d96]">{message}</p>
  </section>;
}

export const SvgTo3DViewer = SvgToCad3DViewer;
