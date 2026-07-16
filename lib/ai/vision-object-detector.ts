export type VisionObjectType =
  | "EQUIPMENT"
  | "PUMP"
  | "MOTOR"
  | "VALVE"
  | "PANEL"
  | "TANK"
  | "INSTRUMENT"
  | "SENSOR"
  | "CONNECTION"
  | "SYMBOL";

export type VisionDetectedObject = {
  id: string;
  type: VisionObjectType;
  name: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  position: { x: number; y: number };
  rotation: number;
  source: "VISION_AI";
};

export type VisionObjectDetectorInput = {
  imageDataUrl: string;
  context?: Record<string, unknown> | null;
  texts?: Array<{ value: string; position: { x: number; y: number } }>;
};

export interface VisionObjectDetectorLike {
  detect(input: VisionObjectDetectorInput): Promise<VisionDetectedObject[]>;
}

const allowedTypes = new Set<VisionObjectType>([
  "EQUIPMENT", "PUMP", "MOTOR", "VALVE", "PANEL", "TANK", "INSTRUMENT", "SENSOR", "CONNECTION", "SYMBOL",
]);

const systemPrompt = [
  "Você é especialista em interpretação de desenhos técnicos CAD, engenharia industrial e diagramas.",
  "Identifique equipamentos, símbolos técnicos, instrumentos e componentes visuais.",
  "Não considere textos isolados, linhas, bordas ou legendas como objetos.",
  "Classifique somente como EQUIPMENT, PUMP, MOTOR, VALVE, PANEL, TANK, INSTRUMENT, SENSOR, CONNECTION ou SYMBOL.",
  "Retorne somente JSON válido no formato {\"objects\":[{\"id\":\"obj-1\",\"type\":\"PUMP\",\"name\":\"pump\",\"confidence\":0.0,\"boundingBox\":{\"x\":0,\"y\":0,\"width\":0,\"height\":0},\"position\":{\"x\":0,\"y\":0},\"rotation\":0}]}.",
].join(" ");

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseObjects(value: unknown): VisionDetectedObject[] {
  const payload = typeof value === "string" ? JSON.parse(value) as { objects?: unknown[] } : value as { objects?: unknown[] };
  if (!payload || !Array.isArray(payload.objects)) throw new Error("VISION_OBJECTS_INVALID_JSON");
  return payload.objects.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const type = String(candidate.type || "").toUpperCase() as VisionObjectType;
    if (!allowedTypes.has(type)) return [];
    const box = candidate.boundingBox as Record<string, unknown> | null;
    const position = candidate.position as Record<string, unknown> | null;
    return [{
      id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : `vision-object-${index + 1}`,
      type,
      name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : type,
      confidence: Math.max(0, Math.min(1, number(candidate.confidence))),
      boundingBox: { x: number(box?.x), y: number(box?.y), width: Math.max(0, number(box?.width)), height: Math.max(0, number(box?.height)) },
      position: { x: number(position?.x, number(box?.x)), y: number(position?.y, number(box?.y)) },
      rotation: number(candidate.rotation),
      source: "VISION_AI" as const,
    }];
  });
}

export class VisionObjectDetector implements VisionObjectDetectorLike {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;

  constructor(options: { apiKey?: string; endpoint?: string; model?: string } = {}) {
    this.apiKey = options.apiKey || process.env.VISION_API_KEY || "";
    this.endpoint = options.endpoint || process.env.VISION_API_URL || "https://api.openai.com/v1/chat/completions";
    this.model = options.model || process.env.VISION_MODEL || "gpt-4.1-mini";
  }

  async detect(input: VisionObjectDetectorInput): Promise<VisionDetectedObject[]> {
    if (!this.apiKey) throw new Error("VISION_API_KEY_MISSING");
    if (!input.imageDataUrl.startsWith("data:image/")) throw new Error("VISION_IMAGE_MISSING");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: [
              { type: "text", text: JSON.stringify({ context: input.context || null, detectedTexts: input.texts || [] }) },
              { type: "image_url", image_url: { url: input.imageDataUrl, detail: "high" } },
            ] },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`VISION_OBJECT_API_${response.status}`);
      const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
      return parseObjects(body.choices?.[0]?.message?.content);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("VISION_OBJECT_API_TIMEOUT");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
