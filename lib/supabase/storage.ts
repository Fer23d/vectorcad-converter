import { supabase } from "@/lib/supabase/client";
import type { CadProjectData } from "@/types/project";

const PROJECT_IMAGES_BUCKET = "project-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const STORAGE_PATH_PATTERN = /^([^/]+)\/(?:source|source-original|processed)\.(?:png|jpg|jpeg|webp|tif|tiff)$/i;

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
  const separator = dataUrl.indexOf(",");
  const header = separator >= 0 ? dataUrl.slice(0, separator) : "";
  const payload = separator >= 0 ? dataUrl.slice(separator + 1) : "";
  if (!/^data:[^;,]+(?:;[^;,]+)*;base64$/i.test(header) || !payload) {
    throw new Error("PROJECT_IMAGE_DATA_UNAVAILABLE");
  }

  const mime = header.slice(5).split(";")[0] || "application/octet-stream";
  let binary: string;
  try {
    binary = atob(payload.replace(/\s/g, ""));
  } catch {
    throw new Error("PROJECT_IMAGE_DATA_UNAVAILABLE");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
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
  const { data: signed, error: signedError } = await supabase.storage
    .from(PROJECT_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signedError || !signed?.signedUrl) throw signedError || new Error("PROJECT_IMAGE_SIGNED_URL_UNAVAILABLE");
  return { path, url: signed.signedUrl };
}

function pathFromStoredUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const marker = `/storage/v1/object/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) return null;
  const remainder = value.slice(markerIndex + marker.length);
  const bucketMarker = `${PROJECT_IMAGES_BUCKET}/`;
  const bucketIndex = remainder.indexOf(bucketMarker);
  if (bucketIndex < 0) return null;
  try {
    return decodeURIComponent(remainder.slice(bucketIndex + bucketMarker.length).split("?")[0]);
  } catch {
    return null;
  }
}

function assertProjectImagePath(projectId: string, path: string) {
  const match = STORAGE_PATH_PATTERN.exec(path);
  if (!match || match[1] !== projectId) throw new Error("PROJECT_IMAGE_PATH_INVALID");
}

async function signedUrlForPath(projectId: string, path: string) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  assertProjectImagePath(projectId, path);
  const { data, error } = await supabase.storage.from(PROJECT_IMAGES_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw error || new Error("PROJECT_IMAGE_SIGNED_URL_UNAVAILABLE");
  return data.signedUrl;
}

/** Replaces image Data URLs with private Storage references and temporary signed URLs. */
export async function persistProjectImagesToStorage(projectId: string, data: CadProjectData): Promise<CadProjectData> {
  const next = { ...data };
  const storagePaths = { ...(next.projectImageStoragePaths || {}) };
  const images: Array<{ key: "sourceImageDataUrl" | "sourceOriginalDataUrl" | "processedImageDataUrl"; type: ProjectImageType }> = [
    { key: "sourceImageDataUrl", type: "source" },
    { key: "sourceOriginalDataUrl", type: "source-original" },
    { key: "processedImageDataUrl", type: "processed" },
  ];
  for (const image of images) {
    const value = next[image.key];
    if (isDataImageUrl(value)) {
      const uploaded = await uploadProjectImageToStorage(projectId, value, image.type);
      storagePaths[image.type] = uploaded.path;
      next[image.key] = uploaded.url;
    } else {
      const path = storagePaths[image.type] || pathFromStoredUrl(value);
      if (path) {
        storagePaths[image.type] = path;
        next[image.key] = await signedUrlForPath(projectId, path);
      }
    }
  }
  if (Object.keys(storagePaths).length) next.projectImageStoragePaths = storagePaths;
  return next;
}

/** Refreshes expiring URLs when an existing project is opened. */
export async function refreshProjectImagesFromStorage(data: CadProjectData | null): Promise<CadProjectData | null> {
  if (!data || !supabase) return data;
  const next = { ...data };
  const storagePaths = { ...(next.projectImageStoragePaths || {}) };
  const images: Array<{ key: "sourceImageDataUrl" | "sourceOriginalDataUrl" | "processedImageDataUrl"; type: ProjectImageType }> = [
    { key: "sourceImageDataUrl", type: "source" },
    { key: "sourceOriginalDataUrl", type: "source-original" },
    { key: "processedImageDataUrl", type: "processed" },
  ];
  for (const image of images) {
    const path = storagePaths[image.type] || pathFromStoredUrl(next[image.key]);
    if (!path) continue;
    storagePaths[image.type] = path;
    try {
      next[image.key] = await signedUrlForPath(path.split("/")[0] || "", path);
    } catch {
      // Invalid legacy references are left untouched so opening a project does not erase its data.
      continue;
    }
  }
  if (Object.keys(storagePaths).length) next.projectImageStoragePaths = storagePaths;
  return next;
}
