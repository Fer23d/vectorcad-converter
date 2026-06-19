"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Download, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

type SvgTo3DViewerProps = {
  svg: string;
  fileName?: string;
  unit?: string;
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

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function buildModelFromSvg(svg: string, depth: number) {
  const loader = new SVGLoader();
  const data = loader.parse(svg);
  const model = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0xb7f34a,
    metalness: 0.12,
    roughness: 0.48,
    side: THREE.DoubleSide,
  });

  data.paths.forEach((path) => {
    const shapes = SVGLoader.createShapes(path);
    shapes.forEach((shape) => {
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
        curveSegments: 12,
        steps: 1,
      });
      const mesh = new THREE.Mesh(geometry, material.clone());
      model.add(mesh);
    });
  });

  model.scale.y = -1;
  const box = new THREE.Box3().setFromObject(model);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
  }

  return model;
}

function baseName(fileName?: string) {
  return (fileName || "vectorcad-3d").replace(/\.[^.]+$/, "") || "vectorcad-3d";
}

export function SvgTo3DViewer({ svg, fileName, unit = "mm" }: SvgTo3DViewerProps) {
  const mount = useRef<HTMLDivElement>(null);
  const state = useRef<ThreeState | null>(null);
  const frame = useRef<number | null>(null);
  const [height, setHeight] = useState(5);
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
    current.camera.position.set(radius * 0.85, -radius * 1.1, radius * 1.2);
    current.camera.updateProjectionMatrix();
    current.controls.update();
  }, []);

  useEffect(() => {
    const host = mount.current;
    if (!host || !svg) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1110);
    scene.add(new THREE.AmbientLight(0xffffff, 0.72));

    const directional = new THREE.DirectionalLight(0xffffff, 1.25);
    directional.position.set(80, -120, 180);
    scene.add(directional);

    const fill = new THREE.DirectionalLight(0xb7f34a, 0.45);
    fill.position.set(-90, 80, 90);
    scene.add(fill);

    const grid = new THREE.GridHelper(180, 18, 0x355044, 0x1c2a25);
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
    controls.screenSpacePanning = true;

    const model = buildModelFromSvg(svg, height);
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

    setMessage(model.children.length ? `Modelo 3D gerado com ${model.children.length} forma(s) extrudada(s).` : "Nenhuma forma fechada foi encontrada no SVG para extrusão.");

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      observer.disconnect();
      controls.dispose();
      disposeObject(model);
      renderer.dispose();
      host.replaceChildren();
      state.current = null;
    };
  }, [height, resetCamera, svg]);

  const exportStl = () => {
    const model = state.current?.model;
    if (!model || model.children.length === 0) return setMessage("Gere um modelo 3D antes de baixar o STL.");
    const result = new STLExporter().parse(model, { binary: true });
    const blob = result instanceof ArrayBuffer
      ? new Blob([result], { type: "model/stl" })
      : new Blob([result], { type: "model/stl" });
    saveBlob(`${baseName(fileName)}.stl`, blob);
    setMessage("Arquivo STL gerado com sucesso.");
  };

  const exportGlb = () => {
    const model = state.current?.model;
    if (!model || model.children.length === 0) return setMessage("Gere um modelo 3D antes de baixar o GLB.");
    new GLTFExporter().parse(
      model,
      (result) => {
        const blob = result instanceof ArrayBuffer
          ? new Blob([result], { type: "model/gltf-binary" })
          : new Blob([JSON.stringify(result)], { type: "model/gltf+json" });
        saveBlob(`${baseName(fileName)}.${result instanceof ArrayBuffer ? "glb" : "gltf"}`, blob);
        setMessage("Arquivo GLB gerado com sucesso.");
      },
      (error) => setMessage(`Nao foi possivel exportar GLB: ${error.message}`),
      { binary: true },
    );
  };

  return <section className="three-panel rounded-xl border border-[#324039] bg-[#111815] p-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#eef6f0]"><Box size={14} /> Preview 3D</h3>
        <p className="mt-1 text-[10px] text-[#87978f]">Extrusao simples do SVG vetorizado para CAD/CAM.</p>
      </div>
      <button type="button" onClick={resetCamera} className="flex items-center gap-1 rounded border border-[#34413b] px-2 py-1.5 text-[9px] text-[#c8d4ce]"><RotateCcw size={12} /> Centralizar</button>
    </div>

    <label className="range-row mb-3 text-xs text-[#aab8b1]">
      <span>Altura ({unit})</span>
      <b className="text-right text-[#e8efeb]">{height}</b>
      <input type="range" min={1} max={60} step={1} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
    </label>

    <div ref={mount} className="three-viewport min-h-[280px] overflow-hidden rounded-lg border border-[#24332d]" />

    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" onClick={exportStl} className="flex items-center justify-center gap-2 rounded-lg bg-[#b7f34a] py-2.5 text-xs font-black text-[#0a120c]"><Download size={14} /> Baixar STL</button>
      <button type="button" onClick={exportGlb} className="flex items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-xs font-black text-[#111713]"><Download size={14} /> Baixar GLB</button>
    </div>
    <p className="mt-2 text-[10px] leading-4 text-[#8f9d96]">{message}</p>
  </section>;
}
