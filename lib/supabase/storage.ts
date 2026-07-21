import { supabase } from "@/lib/supabase/client";
import type { CadProjectData } from "@/types/project";

const PROJECT_IMAGES_BUCKET = "project-images";

type ProjectImageType = "source" | "source-original" | "processed";

function isDataImageUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

function extensionForMime(mime: string) {
  if (mime.includes("tiff")) return "tiff";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "png";
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("PROJECT_IMAGE_DATA_UNAVAILABLE");
  return response.blob();
}

export async function uploadProjectImageToStorage(projectId: string, dataUrl: string, type: ProjectImageType) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const blob = await dataUrlToBlob(dataUrl);
  const contentType = blob.type || "image/png";
  const path = `${projectId}/${type}.${extensionForMime(contentType)}`;
  const { error } = await supabase.storage.from(PROJECT_IMAGES_BUCKET).upload(path, blob, {
    upsert: true,
    contentType,
    cacheControl: "3600",
  });
  if (error) throw error;
  return supabase.storage.from(PROJECT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Replaces legacy image Data URLs with public Storage URLs before JSONB persistence. */
export async function persistProjectImagesToStorage(projectId: string, data: CadProjectData): Promise<CadProjectData> {
  const next = { ...data };
  const images: Array<{ key: "sourceImageDataUrl" | "sourceOriginalDataUrl" | "processedImageDataUrl"; type: ProjectImageType }> = [
    { key: "sourceImageDataUrl", type: "source" },
    { key: "sourceOriginalDataUrl", type: "source-original" },
    { key: "processedImageDataUrl", type: "processed" },
  ];
  for (const image of images) {
    const value = next[image.key];
    if (isDataImageUrl(value)) next[image.key] = await uploadProjectImageToStorage(projectId, value, image.type);
  }
  return next;
}
