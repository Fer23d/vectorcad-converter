const ALLOWED_ELEMENTS = new Set([
  "svg",
  "line",
  "circle",
  "ellipse",
  "path",
  "polyline",
  "polygon",
  "g",
]);

const ALLOWED_ATTRIBUTES = new Set([
  "xmlns",
  "width",
  "height",
  "viewbox",
  "fill",
  "stroke",
  "stroke-width",
  "vector-effect",
  "id",
  "data-layer",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "transform",
  "d",
  "points",
]);

const SAFE_NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?(?:px|mm|cm|m|%)?$/;
const SAFE_VIEW_BOX = /^-?[\d.eE+\s]+$/;
const SAFE_COLOR = /^(?:none|currentColor|transparent|#[0-9a-f]{3,8}|rgba?\([\d\s.,%+-]+\)|[a-z]+)$/i;

export type SafeSvgResult = {
  svg: string;
  removedElements: number;
  removedAttributes: number;
  status: "ok" | "sanitized" | "rejected";
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isSafeAttribute(name: string, value: string) {
  const normalized = name.toLowerCase();
  if (!ALLOWED_ATTRIBUTES.has(normalized)) return false;
  if (normalized.startsWith("on") || normalized.includes("javascript")) return false;
  if (normalized === "d" || normalized === "points" || normalized === "viewbox") return /^[\d.eE+\-\s,MLCZAHVSQTBRFYmlczahvsqtbrfy]+$/.test(value);
  if (["fill", "stroke"].includes(normalized)) return SAFE_COLOR.test(value);
  if (normalized === "transform") return /^(?:rotate\([^)]*\)|translate\([^)]*\)|scale\([^)]*\)|matrix\([^)]*\))(?:\s+(?:rotate\([^)]*\)|translate\([^)]*\)|scale\([^)]*\)|matrix\([^)]*\)))*$/.test(value);
  if (normalized === "viewbox") return SAFE_VIEW_BOX.test(value);
  if (["id", "data-layer", "vector-effect", "xmlns"].includes(normalized)) return !/[<>"'`]/.test(value) && !/^javascript:/i.test(value);
  return SAFE_NUMBER.test(value);
}

/**
 * Rebuilds SVG from a deliberately small element/attribute allowlist.
 * Text nodes are ignored because generated CAD SVG contains geometry only.
 */
export function sanitizeSvg(input: string): SafeSvgResult {
  if (typeof input !== "string" || !input.trim()) return { svg: "", removedElements: 0, removedAttributes: 0, status: "rejected" };

  let removedElements = 0;
  let removedAttributes = 0;
  const output: string[] = [];
  const tokenPattern = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>/g;
  let match: RegExpExecArray | null;
  let sawSvg = false;

  while ((match = tokenPattern.exec(input))) {
    const token = match[0];
    if (token.startsWith("<!--")) {
      removedElements++;
      continue;
    }
    const closing = /^<\//.test(token);
    const nameMatch = token.match(/^<\/?\s*([a-zA-Z][\w:-]*)/);
    if (!nameMatch) {
      removedElements++;
      continue;
    }
    const name = nameMatch[1].toLowerCase();
    if (closing) {
      if (ALLOWED_ELEMENTS.has(name)) output.push(`</${name}>`);
      else removedElements++;
      continue;
    }
    if (!ALLOWED_ELEMENTS.has(name)) {
      removedElements++;
      continue;
    }
    if (name === "svg") sawSvg = true;
    const selfClosing = /\/\s*>$/.test(token);
    const attrsSource = token.slice(nameMatch[0].length, token.length - (selfClosing ? 2 : 1));
    const attrs: string[] = [];
    const attrPattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrPattern.exec(attrsSource))) {
      const attrName = attrMatch[1];
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? "";
      if (isSafeAttribute(attrName, attrValue)) attrs.push(`${attrName.toLowerCase()}="${escapeXml(attrValue)}"`);
      else removedAttributes++;
    }
    output.push(`<${name}${attrs.length ? ` ${attrs.join(" ")}` : ""}${selfClosing ? " />" : ">"}`);
  }

  const svg = sawSvg ? output.join("") : "";
  const status = !svg ? "rejected" : removedElements || removedAttributes ? "sanitized" : "ok";
  console.info("[safe-svg]", { removedElements, removedAttributes, inputLength: input.length, status });
  return { svg, removedElements, removedAttributes, status };
}
