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
type CameraView = "front" | "side" | "top" | "iso" | "perspective";
type Cad2DView = "front" | "side" | "top";

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
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  model: THREE.Group;
  measurementGroup: THREE.Group;
};

type CameraAnimation = {
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  startedAt: number;
  duration: number;
};

type SelectedProperties = {
  name: string | null;
  type: string | null;
  layer: string | null;
  dimensions: string | null;
  material: string | null;
};

type ObjectTreeNode = {
  id: string;
  label: string;
  type: string;
  children: ObjectTreeNode[];
};

type LayerState = {
  name: string;
  visible: boolean;
};

type Measurement = {
  id: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  distance: number;
};

type ViewerTool = "select" | "measure";
type ImageQuality = "best" | "ultra";

const styleLabels: Record<ModelStyle, string> = {
  industrial: "Industrial",
  cad_clean: "CAD Clean",
  wood: "Wood",
  neon: "Neon",
  plastic: "Plastic",
};

const cameraViews: Record<CameraView, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0, 200),
  side: new THREE.Vector3(200, 0, 0),
  top: new THREE.Vector3(0, 200, 0),
  iso: new THREE.Vector3(150, 150, 150),
  perspective: new THREE.Vector3(150, -190, 180),
};

function easeInOutQuad(value: number) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function fitOrthographicCamera(camera: THREE.OrthographicCamera, width: number, height: number, radius: number) {
  const aspect = Math.max(width, 1) / Math.max(height, 1);
  const size = Math.max(radius * 2.6, 120);
  camera.left = -size * aspect / 2;
  camera.right = size * aspect / 2;
  camera.top = size / 2;
  camera.bottom = -size / 2;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
}

function uniqueProjectedPoints(model: THREE.Group, view: Cad2DView) {
  const points: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();
  model.updateMatrixWorld(true);

  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute("position");
    if (!position) return;
    const vertex = new THREE.Vector3();
    for (let index = 0; index < position.count; index++) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
      const projected = view === "front"
        ? { x: vertex.x, y: -vertex.y }
        : view === "side"
          ? { x: vertex.z, y: -vertex.y }
          : { x: vertex.x, y: -vertex.z };
      const key = `${projected.x.toFixed(3)},${projected.y.toFixed(3)}`;
      if (!seen.has(key)) {
        seen.add(key);
        points.push(projected);
      }
    }
  });

  return points;
}

function convexHull(points: Array<{ x: number; y: number }>) {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  const cross = (origin: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower: Array<{ x: number; y: number }> = [];
  const upper: Array<{ x: number; y: number }> = [];

  sorted.forEach((point) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  });
  [...sorted].reverse().forEach((point) => {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  });

  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function projectionPath(model: THREE.Group, view: Cad2DView) {
  const hull = convexHull(uniqueProjectedPoints(model, view));
  if (hull.length < 3) return { path: "", viewBox: "0 0 100 100" };
  const minX = Math.min(...hull.map((point) => point.x));
  const minY = Math.min(...hull.map((point) => point.y));
  const maxX = Math.max(...hull.map((point) => point.x));
  const maxY = Math.max(...hull.map((point) => point.y));
  const padding = Math.max((maxX - minX + maxY - minY) * 0.04, 5);
  const path = hull.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(3)} ${point.y.toFixed(3)}`).join(" ") + " Z";
  return {
    path,
    viewBox: `${(minX - padding).toFixed(3)} ${(minY - padding).toFixed(3)} ${(maxX - minX + padding * 2).toFixed(3)} ${(maxY - minY + padding * 2).toFixed(3)}`,
  };
}

function generateCad2DProjectionSvg(model: THREE.Group) {
  const views: Cad2DView[] = ["front", "top", "side"];
  const drawings = views.map((view, index) => {
    const projection = projectionPath(model, view);
    return `<svg x="${index * 260}" y="34" width="240" height="240" viewBox="${projection.viewBox}"><path d="${projection.path}" fill="none" stroke="#111827" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg><text x="${index * 260 + 8}" y="22">${view.toUpperCase()} VIEW</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="290" viewBox="0 0 780 290"><rect width="100%" height="100%" fill="#ffffff"/><g font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#111827">${drawings}</g></svg>`;
}

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
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
    if (child instanceof THREE.Line || child instanceof THREE.Sprite) {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material.map) material.map.dispose();
        material.dispose();
      });
    }
  });
}

function formatMeasurement(distance: number, unit?: string) {
  const label = unit || "unidades";
  return `${distance.toFixed(2)} ${label}`;
}

function createMeasurementVisual(start: THREE.Vector3, end: THREE.Vector3, label: string) {
  const group = new THREE.Group();
  group.name = "Medição";
  const distance = start.distanceTo(end);
  const pointRadius = Math.max(Math.min(distance * 0.018, 2.5), 0.35);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([start, end]),
    new THREE.LineBasicMaterial({ color: 0xb7f34a, linewidth: 2, depthTest: false }),
  );
  line.renderOrder = 20;
  group.add(line);

  [start, end].forEach((point) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(pointRadius, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
    );
    marker.position.copy(point);
    marker.renderOrder = 21;
    group.add(marker);
  });

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "rgba(8,16,13,.88)";
    context.roundRect(4, 4, 504, 88, 18);
    context.fill();
    context.strokeStyle = "#b7f34a";
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = "#f1f8f3";
    context.font = "700 34px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, 256, 48);
  }
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
  labelSprite.position.copy(start).add(end).multiplyScalar(0.5);
  const labelWidth = Math.max(distance * 0.18, pointRadius * 12);
  labelSprite.scale.set(labelWidth, labelWidth * 0.19, 1);
  labelSprite.renderOrder = 22;
  group.add(labelSprite);
  return group;
}

function getMeshMaterial(object: THREE.Object3D) {
  if (!(object instanceof THREE.Mesh)) return null;
  const material = Array.isArray(object.material) ? object.material[0] : object.material;
  return material instanceof THREE.Material ? material : null;
}

function restoreSelection(object: THREE.Object3D | null) {
  if (!object) return;
  const material = getMeshMaterial(object);
  const original = object.userData.vectorCadSelectionOriginal as { color?: number; emissive?: number; emissiveIntensity?: number } | undefined;
  if (material && original) {
    if ("color" in material && typeof original.color === "number") (material as THREE.MeshStandardMaterial).color.setHex(original.color);
    if ("emissive" in material && typeof original.emissive === "number") (material as THREE.MeshStandardMaterial).emissive.setHex(original.emissive);
    if ("emissiveIntensity" in material && typeof original.emissiveIntensity === "number") (material as THREE.MeshStandardMaterial).emissiveIntensity = original.emissiveIntensity;
  }
  delete object.userData.vectorCadSelectionOriginal;
}

function highlightSelection(object: THREE.Object3D) {
  const material = getMeshMaterial(object);
  if (!material) return;
  const standardMaterial = material as THREE.MeshStandardMaterial;
  object.userData.vectorCadSelectionOriginal = {
    color: "color" in material ? standardMaterial.color.getHex() : undefined,
    emissive: "emissive" in material ? standardMaterial.emissive.getHex() : undefined,
    emissiveIntensity: "emissiveIntensity" in material ? standardMaterial.emissiveIntensity : undefined,
  };
  if ("emissive" in material) standardMaterial.emissive.setHex(0xb7f34a);
  if ("emissiveIntensity" in material) standardMaterial.emissiveIntensity = 0.72;
}

function getSelectedProperties(object: THREE.Object3D, unit?: string): SelectedProperties {
  const box = new THREE.Box3().setFromObject(object);
  const dimensions = box.isEmpty() ? null : (() => {
    const size = box.getSize(new THREE.Vector3());
    const format = (value: number) => value.toFixed(2);
    return `${format(size.x)} × ${format(size.y)} × ${format(size.z)} ${unit || ""}`.trim();
  })();
  const material = getMeshMaterial(object);
  const materialLabel = material
    ? `${material.type}${"color" in material ? ` • #${(material as THREE.MeshStandardMaterial).color.getHexString()}` : ""}`
    : null;
  return {
    name: object.name || null,
    type: object.type || null,
    layer: typeof object.userData.layer === "string" ? object.userData.layer : null,
    dimensions,
    material: materialLabel,
  };
}

function buildObjectTree(object: THREE.Object3D): ObjectTreeNode {
  return {
    id: object.uuid,
    label: object.name || object.type,
    type: object.type,
    children: object.children.map(buildObjectTree),
  };
}

function collectLayerNames(object: THREE.Object3D) {
  const names = new Set<string>();
  object.traverse((child) => {
    if (typeof child.userData.layer === "string" && child.userData.layer.trim()) names.add(child.userData.layer.trim());
  });
  return [...names].sort((a, b) => a.localeCompare(b));
}

function ObjectTreeItem({ node, depth, onSelect }: { node: ObjectTreeNode; depth: number; onSelect: (id: string) => void }) {
  return <div>
    <button type="button" onClick={() => onSelect(node.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-[#cbd8d0] transition hover:bg-[#1c2b21] hover:text-[#b7f34a]" style={{ paddingLeft: `${8 + depth * 14}px` }}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#b7f34a]" />
      <span className="min-w-0 truncate">{node.label}</span>
      <span className="ml-auto shrink-0 text-[9px] text-[#68786e]">{node.type}</span>
    </button>
    {node.children.map((child) => <ObjectTreeItem key={child.id} node={child} depth={depth + 1} onSelect={onSelect} />)}
  </div>;
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
  const settings: Record<ModelStyle, { background: number; ambient: number; directional: number; fill: number; grid: number; ground: number }> = {
    industrial: { background: 0x1e2225, ambient: 0.45, directional: 1.55, fill: 0.25, grid: 0x3a4248, ground: 0x202529 },
    cad_clean: { background: 0xf1f3f1, ambient: 0.82, directional: 1.05, fill: 0.18, grid: 0xc8d0cc, ground: 0xe7ebe8 },
    wood: { background: 0xf4eee6, ambient: 0.7, directional: 1.25, fill: 0.28, grid: 0xcab8a4, ground: 0xefe3d5 },
    neon: { background: 0x080916, ambient: 0.34, directional: 1.45, fill: 1.1, grid: 0x262a58, ground: 0x0d1024 },
    plastic: { background: 0xe8e8e3, ambient: 0.76, directional: 1.18, fill: 0.22, grid: 0xc2c6bf, ground: 0xdfe1dc },
  };
  const next = settings[style];
  scene.background = new THREE.Color(next.background);
  scene.traverse((object) => {
    if (object instanceof THREE.AmbientLight) object.intensity = next.ambient;
    if (object instanceof THREE.DirectionalLight && object.name === "key-light") object.intensity = next.directional;
    if (object instanceof THREE.DirectionalLight && object.name === "fill-light") object.intensity = next.fill;
    if (object instanceof THREE.GridHelper) object.material.color.setHex(next.grid);
    if (object instanceof THREE.Mesh && object.name === "ground" && object.material instanceof THREE.MeshStandardMaterial) object.material.color.setHex(next.ground);
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
  model.name = "Projeto 3D";
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
  mesh.name = options.enhanced ? "VetorCAD_Enhanced_Extrusion" : "VetorCAD_Extrusion";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  apply3DStyle(mesh, options.style);
  model.add(mesh);

  return model;
}

export function SvgTo3DCadViewer({ svg, fileName, unit }: SvgTo3DCadViewerProps) {
  const mount = useRef<HTMLDivElement>(null);
  const state = useRef<ThreeState | null>(null);
  const frame = useRef<number | null>(null);
  const renderRequest = useRef<(() => void) | null>(null);
  const cameraAnimation = useRef<CameraAnimation | null>(null);
  const selectedObject = useRef<THREE.Object3D | null>(null);
  const measurementPoints = useRef<THREE.Vector3[]>([]);
  const activeToolRef = useRef<ViewerTool>("select");
  const [height, setHeight] = useState(5);
  const [enhanced, setEnhanced] = useState(false);
  const [imageQuality, setImageQuality] = useState<ImageQuality>("best");
  const imageQualityRef = useRef<ImageQuality>("best");
  const [aiClean, setAiClean] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<ModelStyle>("cad_clean");
  const [appliedStyle, setAppliedStyle] = useState<ModelStyle>("cad_clean");
  const [qualityRun, setQualityRun] = useState(0);
  const [loading, setLoading] = useState(() => Boolean(svg));
  const [loadingStage, setLoadingStage] = useState("Preparando modelo 3D...");
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);
  const [hasGeometry, setHasGeometry] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<SelectedProperties | null>(null);
  const [objectTree, setObjectTree] = useState<ObjectTreeNode | null>(null);
  const [layers, setLayers] = useState<LayerState[]>([]);
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ViewerTool>("select");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [message, setMessage] = useState("Clique e arraste para girar. Use o scroll para aproximar.");

  const clearSelection = useCallback(() => {
    restoreSelection(selectedObject.current);
    selectedObject.current = null;
    setSelectedProperties(null);
  }, []);

  const clearMeasurements = useCallback(() => {
    const group = state.current?.measurementGroup;
    if (group) {
      while (group.children.length) {
        const child = group.children.pop();
        if (child) {
          group.remove(child);
          disposeObject(child);
        }
      }
    }
    measurementPoints.current = [];
    setMeasurements([]);
    renderRequest.current?.();
    setMessage("Medições limpas.");
  }, []);

  const chooseTool = useCallback((tool: ViewerTool) => {
    activeToolRef.current = tool;
    measurementPoints.current = [];
    setActiveTool(tool);
    setMessage(tool === "measure" ? "Clique no ponto inicial da medição." : "Modo de seleção ativo.");
  }, []);

  const addMeasurementPoint = useCallback((point: THREE.Vector3) => {
    const nextPoints = [...measurementPoints.current, point.clone()];
    if (nextPoints.length < 2) {
      measurementPoints.current = nextPoints;
      setMessage("Ponto inicial definido. Clique no ponto final.");
      return;
    }

    const [start, end] = nextPoints;
    const measurement: Measurement = {
      id: crypto.randomUUID(),
      start,
      end,
      distance: start.distanceTo(end),
    };
    const current = state.current;
    if (current) current.measurementGroup.add(createMeasurementVisual(start, end, formatMeasurement(measurement.distance, unit)));
    measurementPoints.current = [];
    setMeasurements((previous) => [...previous, measurement]);
    renderRequest.current?.();
    setMessage(`Distância medida: ${formatMeasurement(measurement.distance, unit)}.`);
  }, [unit]);

  const getModelFocus = useCallback(() => {
    const current = state.current;
    if (!current) return null;
    const box = new THREE.Box3().setFromObject(current.model);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 10);
    return { center: sphere.center, radius };
  }, []);

  const animateCameraTo = useCallback((toPosition: THREE.Vector3, toTarget = new THREE.Vector3(0, 0, 0), duration = 850) => {
    const current = state.current;
    if (!current) return;
    current.controls.enabled = false;
    cameraAnimation.current = {
      fromPosition: current.camera.position.clone(),
      toPosition,
      fromTarget: current.controls.target.clone(),
      toTarget,
      startedAt: performance.now(),
      duration,
    };
    renderRequest.current?.();
  }, []);

  const resetCamera = useCallback(() => {
    const current = state.current;
    const focus = getModelFocus();
    if (!current || !focus) return;
    const radius = focus.radius;

    fitOrthographicCamera(current.camera, current.renderer.domElement.clientWidth, current.renderer.domElement.clientHeight, radius);
    current.controls.target.copy(focus.center);
    current.camera.near = Math.max(radius / 1000, 0.01);
    current.camera.far = radius * 1000;
    current.camera.position.copy(focus.center.clone().add(new THREE.Vector3(radius * 0.85, -radius * 1.1, radius * 1.15)));
    current.camera.updateProjectionMatrix();
    current.controls.update();
  }, [getModelFocus]);

  const setCameraView = useCallback((viewType: CameraView) => {
    const current = state.current;
    const focus = getModelFocus();
    if (!current || !focus) return;
    const target = focus.center.clone();
    const base = cameraViews[viewType].clone();
    const distanceScale = Math.max(1, focus.radius / 80);
    const toPosition = viewType === "perspective"
      ? target.clone().add(new THREE.Vector3(focus.radius * 0.9, -focus.radius * 1.15, focus.radius * 1.1))
      : target.clone().add(base.multiplyScalar(distanceScale));

    fitOrthographicCamera(current.camera, current.renderer.domElement.clientWidth, current.renderer.domElement.clientHeight, focus.radius);
    current.controls.enableRotate = viewType === "iso" || viewType === "perspective";
    current.camera.near = Math.max(focus.radius / 1000, 0.01);
    current.camera.far = Math.max(focus.radius * 1000, 1000);
    current.camera.updateProjectionMatrix();
    animateCameraTo(toPosition, target, viewType === "perspective" ? 900 : 750);
    setMessage(`Vista ${viewType} aplicada com transicao suave.`);
  }, [animateCameraTo, getModelFocus]);

  const autoFitView = useCallback(() => {
    const current = state.current;
    const focus = getModelFocus();
    if (!current || !focus) return;
    const direction = current.camera.position.clone().sub(current.controls.target).normalize();
    const safeDirection = direction.lengthSq() > 0 ? direction : new THREE.Vector3(0.7, -0.8, 0.9).normalize();
    const distance = Math.max(focus.radius * 4, 100);
    fitOrthographicCamera(current.camera, current.renderer.domElement.clientWidth, current.renderer.domElement.clientHeight, focus.radius);
    current.camera.near = Math.max(focus.radius / 1000, 0.01);
    current.camera.far = Math.max(distance * 10, 1000);
    current.camera.updateProjectionMatrix();
    animateCameraTo(focus.center.clone().add(safeDirection.multiplyScalar(distance)), focus.center.clone(), 850);
    setMessage("Auto Fit View aplicado ao modelo.");
  }, [animateCameraTo, getModelFocus]);

  const focusObject = useCallback((object: THREE.Object3D) => {
    const current = state.current;
    if (!current) return;
    const box = new THREE.Box3().setFromObject(object);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) return;
    const direction = current.camera.position.clone().sub(current.controls.target).normalize();
    const safeDirection = direction.lengthSq() > 0 ? direction : new THREE.Vector3(0.7, -0.8, 0.9).normalize();
    const distance = Math.max(sphere.radius * 3.8, 40);
    fitOrthographicCamera(current.camera, current.renderer.domElement.clientWidth, current.renderer.domElement.clientHeight, sphere.radius);
    current.camera.near = Math.max(sphere.radius / 1000, 0.01);
    current.camera.far = Math.max(distance * 10, 1000);
    current.camera.updateProjectionMatrix();
    animateCameraTo(sphere.center.clone().add(safeDirection.multiplyScalar(distance)), sphere.center.clone(), 650);
  }, [animateCameraTo]);

  const selectObject = useCallback((object: THREE.Object3D | null, center = false) => {
    clearSelection();
    if (!object) return;
    highlightSelection(object);
    renderRequest.current?.();
    selectedObject.current = object;
    setSelectedProperties(getSelectedProperties(object, unit));
    if (center) focusObject(object);
  }, [clearSelection, focusObject, unit]);

  const updateLayerVisibility = useCallback((layerName: string, visible: boolean) => {
    const model = state.current?.model;
    if (!model) return;
    model.traverse((object) => {
      if (object.userData.layer === layerName) object.visible = visible;
    });
    if (!visible && selectedObject.current?.userData.layer === layerName) clearSelection();
    renderRequest.current?.();
    setLayers((current) => current.map((layer) => layer.name === layerName ? { ...layer, visible } : layer));
  }, [clearSelection]);

  const selectLayer = useCallback((layerName: string) => {
    setActiveLayer(layerName);
    const model = state.current?.model;
    if (!model) return;
    let firstObject: THREE.Object3D | null = null;
    model.traverse((object) => {
      if (!firstObject && object.userData.layer === layerName) firstObject = object;
    });
    if (firstObject) selectObject(firstObject, true);
  }, [selectObject]);

  const selectTreeNode = useCallback((id: string) => {
    const object = state.current?.model.getObjectByProperty("uuid", id) || null;
    selectObject(object, true);
  }, [selectObject]);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    if (!svg) {
      const emptyTimer = window.setTimeout(() => {
        setLoading(false);
        setLoadingStage("Nenhum modelo carregado");
        setLoadTimeMs(null);
        setHasGeometry(false);
        setObjectTree(null);
        setLayers([]);
        setActiveLayer(null);
        setMessage("Nenhum SVG disponível para gerar a geometria 3D.");
      }, 0);
      return () => window.clearTimeout(emptyTimer);
    }

    let disposed = false;
    const loadStartedAt = performance.now();
    const loadingTimer = window.setTimeout(() => {
      if (!disposed) {
        setLoading(true);
        setLoadingStage("Preparando modelo 3D...");
        setLoadTimeMs(null);
      }
    }, 0);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe7ebe8);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    scene.add(new THREE.HemisphereLight(0xf7fbf8, 0x26372f, 0.38));

    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    directional.name = "key-light";
    directional.position.set(80, -120, 180);
    directional.castShadow = true;
    directional.shadow.mapSize.set(1024, 1024);
    directional.shadow.camera.left = -260;
    directional.shadow.camera.right = 260;
    directional.shadow.camera.top = 260;
    directional.shadow.camera.bottom = -260;
    directional.shadow.camera.near = 1;
    directional.shadow.camera.far = 900;
    directional.shadow.bias = -0.0002;
    scene.add(directional);

    const fill = new THREE.DirectionalLight(0xb7f34a, 0.25);
    fill.name = "fill-light";
    fill.position.set(-90, 80, 90);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshStandardMaterial({ color: 0xe7ebe8, roughness: 0.96, metalness: 0, transparent: true, opacity: 0.72 }),
    );
    ground.name = "ground";
    ground.position.z = -height / 2 - 0.12;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(420, 42, 0xb8c2bd, 0xd4dbd7);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -height / 2 - 0.1;
    scene.add(grid);

    const camera = new THREE.OrthographicCamera(-120, 120, 120, -120, 0.1, 100000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const initialUltra = imageQualityRef.current === "ultra";
    renderer.setPixelRatio(Math.min(window.devicePixelRatio * (initialUltra ? 1.25 : 1), initialUltra ? 2 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.75;
    controls.rotateSpeed = 0.72;
    controls.panSpeed = 0.8;
    controls.screenSpacePanning = true;
    controls.minZoom = 0.35;
    controls.maxZoom = 8;

    const geometryStageTimer = window.setTimeout(() => {
      if (!disposed) setLoadingStage("Carregando geometria...");
    }, 0);
    let model: THREE.Group;
    try {
      model = buildModelFromSvg(svg, { depth: height, enhanced, cleanSvg: aiClean, style: "cad_clean" });
    } catch {
      model = new THREE.Group();
    }
    const measurementGroup = new THREE.Group();
    measurementGroup.name = "Medições";
    scene.add(model);
    scene.add(measurementGroup);
    state.current = { scene, camera, renderer, controls, model, measurementGroup };

    const raycaster = new THREE.Raycaster();
    let pointerStart: { x: number; y: number } | null = null;
    const handlePointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerStart) return;
      const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      pointerStart = null;
      if (moved > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(model.children, true)[0];
      const object = hit?.object || null;
      if (activeToolRef.current === "measure") {
        if (hit) addMeasurementPoint(hit.point);
        else setMessage("Selecione um ponto sobre a geometria do modelo.");
        return;
      }
      selectObject(object);
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const viewHeight = Math.max(host.clientHeight, 1);
      renderer.setSize(width, viewHeight, false);
      const focus = getModelFocus();
      fitOrthographicCamera(camera, width, viewHeight, focus?.radius || 80);
      renderRequest.current?.();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    resetCamera();

    let renderDirty = true;
    let renderLoopActive = false;
    const requestRender = () => {
      renderDirty = true;
      if (!renderLoopActive) {
        renderLoopActive = true;
        frame.current = requestAnimationFrame(animate);
      }
    };
    renderRequest.current = requestRender;
    controls.addEventListener("change", requestRender);

    const animate = () => {
      const animation = cameraAnimation.current;
      if (animation) {
        const progress = Math.min((performance.now() - animation.startedAt) / animation.duration, 1);
        const eased = easeInOutQuad(progress);
        camera.position.lerpVectors(animation.fromPosition, animation.toPosition, eased);
        controls.target.lerpVectors(animation.fromTarget, animation.toTarget, eased);
        camera.lookAt(controls.target);
        if (progress >= 1) {
          cameraAnimation.current = null;
          controls.enabled = true;
        }
      }
      const controlsChanged = controls.update();
      if (animation || controlsChanged || renderDirty) {
        renderer.render(scene, camera);
        renderDirty = false;
      }
      if (animation || controlsChanged || renderDirty) {
        frame.current = requestAnimationFrame(animate);
      } else {
        frame.current = null;
        renderLoopActive = false;
      }
    };
    requestRender();

    const mesh = model.children[0] as THREE.Mesh | undefined;
    const count = mesh?.geometry.getAttribute("position")?.count || 0;
    renderer.shadowMap.enabled = count > 0 && count <= (imageQualityRef.current === "ultra" ? 250000 : 150000);
    const statusMessage = mesh
      ? `${aiClean ? "SVG limpo + " : ""}${enhanced ? "modelo 3D aprimorado" : "modelo 3D"} gerado com ${count.toLocaleString("pt-BR")} vertices otimizados.`
      : "Nenhuma forma fechada foi encontrada no SVG para extrusao.";
    const statusTimer = window.setTimeout(() => {
      if (!disposed) {
        setLoadingStage(mesh ? "Modelo pronto" : "Falha ao carregar modelo");
        setLoadTimeMs(Math.round(performance.now() - loadStartedAt));
        setMessage(mesh ? statusMessage : "Não foi possível carregar o modelo 3D. Tente novamente.");
      }
    }, 0);
    const treeSnapshot = buildObjectTree(model);
    const layerSnapshot = collectLayerNames(model);
    const metadataTimer = window.setTimeout(() => {
      if (!disposed) {
        setObjectTree(treeSnapshot);
        setLayers(layerSnapshot.map((name) => ({ name, visible: true })));
        setActiveLayer(null);
      }
    }, 0);
    const completeTimer = window.setTimeout(() => {
      if (!disposed) {
        setHasGeometry(Boolean(mesh));
        setLoading(false);
      }
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(loadingTimer);
      window.clearTimeout(geometryStageTimer);
      window.clearTimeout(completeTimer);
      window.clearTimeout(statusTimer);
      window.clearTimeout(metadataTimer);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      controls.removeEventListener("change", requestRender);
      clearSelection();
      if (frame.current) cancelAnimationFrame(frame.current);
      renderRequest.current = null;
      renderLoopActive = false;
      cameraAnimation.current = null;
      observer.disconnect();
      controls.dispose();
      disposeObject(model);
      disposeObject(measurementGroup);
      measurementPoints.current = [];
      setMeasurements([]);
      ground.geometry.dispose();
      ground.material.dispose();
      grid.geometry.dispose();
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      host.replaceChildren();
      state.current = null;
    };
  }, [addMeasurementPoint, aiClean, clearSelection, enhanced, getModelFocus, height, qualityRun, resetCamera, selectObject, svg]);

  useEffect(() => {
    const current = state.current;
    const mesh = current?.model.children[0];
    if (!current || !(mesh instanceof THREE.Mesh)) return;
    apply3DStyle(mesh, appliedStyle);
    applySceneStyle(current.scene, appliedStyle);
    renderRequest.current?.();
    setMessage(`Estilo ${styleLabels[appliedStyle]} aplicado em tempo real.`);
  }, [appliedStyle]);

  useEffect(() => {
    imageQualityRef.current = imageQuality;
    const current = state.current;
    if (!current) return;
    const mesh = current.model.children[0];
    const position = mesh instanceof THREE.Mesh ? mesh.geometry.getAttribute("position") : null;
    const vertexCount = position?.count || 0;
    const ultra = imageQuality === "ultra";
    current.renderer.setPixelRatio(Math.min(window.devicePixelRatio * (ultra ? 1.25 : 1), ultra ? 2 : 1.5));
    current.renderer.shadowMap.enabled = vertexCount > 0 && vertexCount <= (ultra ? 250000 : 150000);
    current.renderer.toneMappingExposure = ultra ? 1.12 : 1.08;
    current.renderer.setSize(Math.max(mount.current?.clientWidth || 1, 1), Math.max(mount.current?.clientHeight || 1, 1), false);
    renderRequest.current?.();
    setMessage(ultra ? "Qualidade Ultra aplicada sem reiniciar o modelo." : "Melhor imagem aplicada.");
  }, [imageQuality]);

  const improveModel = () => {
    setEnhanced(true);
    setQualityRun((value) => value + 1);
    setMessage("Modo aprimorado aplicado: vertices duplicados removidos, normals recalculadas e bordas suavizadas.");
  };

  const fixModel = () => {
    setAiClean(true);
    setEnhanced(true);
    setQualityRun((value) => value + 1);
    setMessage("CAD Clean aplicado: SVG normalizado, paths fechados e pontos duplicados reduzidos.");
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
      (error) => setMessage(`Não foi possível exportar GLB: ${error.message}`),
      { binary: true },
    );
  };

  const exportCad2DSvg = () => {
    const model = state.current?.model;
    if (!model || model.children.length === 0) return setMessage("Gere um modelo 3D antes de exportar o CAD 2D.");
    saveBlob(`${baseName(fileName)}-cad-2d.svg`, new Blob([generateCad2DProjectionSvg(model)], { type: "image/svg+xml" }));
    setMessage("Export CAD 2D (SVG) gerado com front, top e side view.");
  };

  return <section className="three-panel rounded-xl border border-[#324039] bg-[#111815] p-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#eef6f0]"><Box size={14} /> SvgTo3DCadViewer</h3>
        <p className="mt-1 text-[10px] text-[#87978f]">Extrusao CAD em mm a partir do SVG vetorizado.</p>
      </div>
      <button type="button" onClick={() => setCameraView("perspective")} className="flex items-center gap-1 rounded border border-[#34413b] px-2 py-1.5 text-[9px] text-[#c8d4ce]"><RotateCcw size={12} /> Resetar câmera</button>
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

    <fieldset className="mb-3 rounded-lg border border-[#26332e] bg-[#0d1411] p-3" title="Melhor imagem usa o perfil padrão. Ultra aumenta a resolução e a qualidade das sombras quando a GPU comporta.">
      <legend className="px-1 text-[10px] font-black uppercase tracking-[.14em] text-[#b7f34a]">Qualidade da imagem</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-[11px] transition ${imageQuality === "best" ? "border-[#b7f34a] bg-[#1b281d] text-[#eef6f0]" : "border-[#34413b] text-[#9aa9a1] hover:border-[#667a6c]"}`}>
          <input type="radio" name="image-quality" value="best" checked={imageQuality === "best"} onChange={() => setImageQuality("best")} />
          <span>Melhor imagem</span>
        </label>
        <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-[11px] transition ${imageQuality === "ultra" ? "border-[#b7f34a] bg-[#1b281d] text-[#eef6f0]" : "border-[#34413b] text-[#9aa9a1] hover:border-[#667a6c]"}`}>
          <input type="radio" name="image-quality" value="ultra" checked={imageQuality === "ultra"} onChange={() => setImageQuality("ultra")} />
          <span>Melhor imagem Ultra</span>
        </label>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[#718078]">Ultra aumenta a resolução e o acabamento visual. Pode consumir mais GPU em modelos grandes.</p>
    </fieldset>

    <div className="relative">
      <div ref={mount} className="three-viewport min-h-[300px] overflow-hidden rounded-lg border border-[#24332d]" />
      <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1 rounded-lg border border-[#26332e] bg-[#08100d]/80 p-1 backdrop-blur">
        <button type="button" onClick={() => setCameraView("front")} className="rounded bg-[#18231d] px-2 py-1.5 text-[9px] font-black text-[#dce8e1] transition hover:bg-[#b7f34a] hover:text-[#09120d]">Frontal</button>
        <button type="button" onClick={() => setCameraView("top")} className="rounded bg-[#18231d] px-2 py-1.5 text-[9px] font-black text-[#dce8e1] transition hover:bg-[#b7f34a] hover:text-[#09120d]">Superior</button>
        <button type="button" onClick={() => setCameraView("side")} className="rounded bg-[#18231d] px-2 py-1.5 text-[9px] font-black text-[#dce8e1] transition hover:bg-[#b7f34a] hover:text-[#09120d]">Lateral</button>
        <button type="button" onClick={() => setCameraView("iso")} className="rounded bg-[#243522] px-2 py-1.5 text-[9px] font-black text-[#b7f34a] transition hover:bg-[#b7f34a] hover:text-[#09120d]">Iso</button>
        <button type="button" onClick={() => setCameraView("perspective")} className="rounded bg-[#eef5f1] px-2 py-1.5 text-[9px] font-black text-[#111713] transition hover:bg-white">Resetar</button>
        <button type="button" onClick={autoFitView} className="rounded border border-[#b7f34a]/60 bg-[#162219] px-2 py-1.5 text-[9px] font-black text-[#b7f34a] transition hover:bg-[#b7f34a] hover:text-[#09120d]">Auto Fit</button>
      </div>
      <div className="absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1 rounded-lg border border-[#26332e] bg-[#08100d]/85 p-1 backdrop-blur" aria-label="Ferramentas de medição 3D">
        <button type="button" onClick={() => chooseTool("select")} className={`rounded px-2 py-1.5 text-[9px] font-black transition ${activeTool === "select" ? "bg-[#b7f34a] text-[#09120d]" : "bg-[#18231d] text-[#dce8e1] hover:bg-[#26332e]"}`}>Selecionar</button>
        <button type="button" onClick={() => chooseTool("measure")} className={`rounded px-2 py-1.5 text-[9px] font-black transition ${activeTool === "measure" ? "bg-[#b7f34a] text-[#09120d]" : "bg-[#18231d] text-[#dce8e1] hover:bg-[#26332e]"}`}>Medir</button>
        <button type="button" onClick={clearMeasurements} disabled={!measurements.length} className="rounded border border-[#6b3939] px-2 py-1.5 text-[9px] font-black text-[#ffb4ae] transition hover:bg-[#6b3939] disabled:cursor-not-allowed disabled:opacity-40">Limpar medições</button>
      </div>
      {loading && <div className="absolute inset-0 grid place-items-center rounded-lg bg-[#08100d]/70 backdrop-blur-[2px]"><div className="rounded-xl border border-[#b7f34a]/40 bg-[#101613]/95 px-4 py-3 text-center text-xs font-bold text-[#dce8e1]"><div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-[#34443b] border-t-[#b7f34a]" />{loadingStage}</div></div>}
      {!loading && !hasGeometry && <div className="absolute inset-0 grid place-items-center rounded-lg bg-[#08100d]/55 px-5 text-center"><div className="rounded-xl border border-[#56665d] bg-[#101613]/95 px-4 py-3 text-xs text-[#b9c8c0]">Nenhuma geometria encontrada.<br /><span className="text-[10px] text-[#829087]">Ajuste o SVG e tente gerar o modelo novamente.</span></div></div>}
      {selectedProperties && <aside className="absolute right-2 top-2 z-20 w-56 rounded-xl border border-[#b7f34a]/40 bg-[#101613]/95 p-3 text-xs shadow-2xl shadow-black/40 backdrop-blur" aria-label="Propriedades do objeto selecionado">
        <div className="flex items-center justify-between gap-2 border-b border-[#26332e] pb-2">
          <div className="font-black uppercase tracking-[.14em] text-[#b7f34a]">Propriedades</div>
          <button type="button" onClick={clearSelection} aria-label="Fechar propriedades" className="rounded-md px-2 py-1 text-[#8d9a93] transition hover:bg-[#26332e] hover:text-white">×</button>
        </div>
        <dl className="mt-3 grid gap-2.5">
          {([["Objeto", selectedProperties.name], ["Tipo", selectedProperties.type], ["Camada", selectedProperties.layer], ["Dimensões", selectedProperties.dimensions], ["Material", selectedProperties.material]] as const).map(([label, value]) => <div key={label}>
            <dt className="text-[9px] font-black uppercase tracking-[.12em] text-[#718078]">{label}</dt>
            <dd className="mt-0.5 break-words text-[#e3ece6]">{value || "Informação não disponível"}</dd>
          </div>)}
        </dl>
      </aside>}
    </div>

    {measurements.length > 0 && <section className="mt-3 rounded-xl border border-[#2b3832] bg-[#0d1411] p-3" aria-label="Medições">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[.16em] text-[#b7f34a]">Medições</div>
        <span className="text-[10px] text-[#829087]">{measurements.length} registrada{measurements.length === 1 ? "" : "s"}</span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {measurements.map((measurement, index) => <div key={measurement.id} className="rounded-lg border border-[#26332e] bg-[#0a0f0d] px-3 py-2 text-[11px] text-[#dce8e1]">
          <span className="mr-2 text-[#829087]">#{index + 1}</span>
          <strong className="text-[#b7f34a]">{formatMeasurement(measurement.distance, unit)}</strong>
        </div>)}
      </div>
    </section>}

    <div className="mt-3 grid gap-2 lg:grid-cols-2">
      <section className="rounded-xl border border-[#2b3832] bg-[#0d1411] p-3" aria-label="Estrutura do projeto">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-[#b7f34a]">Estrutura do projeto</div>
        {objectTree ? <div className="max-h-40 overflow-y-auto rounded-lg border border-[#26332e] bg-[#0a0f0d] py-1"><ObjectTreeItem node={objectTree} depth={0} onSelect={selectTreeNode} /></div> : <p className="rounded-lg border border-dashed border-[#34443b] px-3 py-4 text-[11px] text-[#829087]">Nenhum objeto carregado.</p>}
      </section>
      <section className="rounded-xl border border-[#2b3832] bg-[#0d1411] p-3" aria-label="Layers">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-[#b7f34a]">Layers</div>
        {layers.length ? <div className="max-h-40 overflow-y-auto rounded-lg border border-[#26332e] bg-[#0a0f0d] p-1">{layers.map((layer) => <div key={layer.name} className={`flex items-center gap-1 rounded-md p-1 ${activeLayer === layer.name ? "bg-[#1c2b21]" : ""}`}>
          <button type="button" onClick={() => updateLayerVisibility(layer.name, !layer.visible)} aria-label={`${layer.visible ? "Ocultar" : "Exibir"} layer ${layer.name}`} className="grid h-7 w-7 place-items-center rounded text-[#b7f34a] transition hover:bg-[#26332e]">{layer.visible ? "☑" : "☐"}</button>
          <button type="button" onClick={() => selectLayer(layer.name)} className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-[11px] text-[#dce8e1] hover:text-[#b7f34a]">{layer.name}</button>
        </div>)}</div> : <p className="rounded-lg border border-dashed border-[#34443b] px-3 py-4 text-[11px] text-[#829087]">Nenhuma camada disponível neste modelo.</p>}
      </section>
    </div>

    <div className="mt-3 grid gap-2">
      <div className="rounded-xl border border-[#2b3832] bg-[#0d1411] p-3">
        <div className="mb-3 text-[10px] font-black uppercase tracking-[.16em] text-[#b7f34a]">Melhoria de imagem</div>
        <div className="grid gap-2">
          <button type="button" onClick={fixModel} className="flex items-center justify-center gap-2 rounded-lg border border-[#b7f34a]/60 bg-[#1b241c] py-2.5 text-xs font-black text-[#b7f34a]">✨ Fix Model (CAD Clean)</button>
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
      <button type="button" onClick={exportCad2DSvg} className="flex items-center justify-center gap-2 rounded-lg border border-[#6fb8ff]/60 bg-[#102033] py-2.5 text-xs font-black text-[#b9dcff]"><Download size={14} /> Export CAD 2D (SVG)</button>
    </div>
    <p className="mt-2 text-[10px] leading-4 text-[#8f9d96]">{message}{loadTimeMs !== null && <span className="ml-2 text-[#65746c]">({loadTimeMs} ms)</span>}</p>
  </section>;
}

export const SvgToCad3DViewer = SvgTo3DCadViewer;
export const SvgTo3DViewer = SvgTo3DCadViewer;
