import { useCallback, useEffect, useRef, useState } from "react";
import type { CadProjectData } from "@/types/project";

export type LocalProjectDraft = {
  projectId: string | null;
  data: CadProjectData;
  updatedAt: string;
};

const pendingDraftTimers = new Map<string, number>();
const LOCAL_DRAFT_DELAY_MS = 60_000;
const LARGE_DATA_URL_LENGTH = 1_000_000;

function compactDraftData(data: CadProjectData): CadProjectData {
  const compacted = { ...data };
  const imageKeys: Array<"sourceImageDataUrl" | "sourceOriginalDataUrl" | "processedImageDataUrl"> = ["sourceImageDataUrl", "sourceOriginalDataUrl", "processedImageDataUrl"];
  for (const key of imageKeys) {
    const value = compacted[key];
    if (typeof value === "string" && value.startsWith("data:image") && value.length > LARGE_DATA_URL_LENGTH) compacted[key] = undefined;
  }
  return compacted;
}

export function localProjectDraftKey(userId: string) {
  return `currentProject-${userId}`;
}

function readDraft(userId: string): LocalProjectDraft | null {
  try {
    const raw = window.localStorage.getItem(localProjectDraftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalProjectDraft>;
    if (!parsed.data || typeof parsed.data !== "object") return null;
    return {
      projectId: typeof parsed.projectId === "string" ? parsed.projectId : null,
      data: parsed.data as CadProjectData,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function clearLocalProjectDraft(userId?: string | null) {
  if (!userId) return;
  cancelLocalProjectDraftTimer(userId);
  try {
    window.localStorage.removeItem(localProjectDraftKey(userId));
  } catch {
    // Storage can be unavailable in private browsing or with restrictive policies.
  }
}

// Manual backend saves cancel only the pending local timer. The last confirmed
// local draft is kept until Supabase confirms the official save.
export function cancelLocalProjectDraftTimer(userId?: string | null) {
  if (!userId) return;
  try {
    const key = localProjectDraftKey(userId);
    const pendingTimer = pendingDraftTimers.get(key);
    if (pendingTimer) window.clearTimeout(pendingTimer);
    pendingDraftTimers.delete(key);
  } catch {
    // Storage can be unavailable in private browsing or with restrictive policies.
  }
}

export function useLocalProjectDraft({ userId, projectId, hasInitialData, clearSignal }: { userId?: string | null; projectId?: string | null; hasInitialData: boolean; clearSignal?: string }) {
  const timer = useRef<number | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<LocalProjectDraft | null>(null);
  const [localDraftDirty, setLocalDraftDirty] = useState(false);

  // Read only the current user's draft. A project draft can restore into the
  // editor even before the dashboard has selected the matching backend row.
  useEffect(() => {
    if (!userId) {
      const resetTimer = window.setTimeout(() => setRestoredDraft(null), 0);
      return () => window.clearTimeout(resetTimer);
    }

    const restoreTimer = window.setTimeout(() => {
      const stored = readDraft(userId);
      const belongsToCurrentProject = !hasInitialData || stored?.projectId === projectId;
      setRestoredDraft(stored && belongsToCurrentProject ? stored : null);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [hasInitialData, projectId, userId]);

  useEffect(() => {
    if (!clearSignal || !userId) return;
    const clearTimer = window.setTimeout(() => {
      clearLocalProjectDraft(userId);
      setRestoredDraft(null);
      setLocalDraftDirty(false);
    }, 0);
    return () => window.clearTimeout(clearTimer);
  }, [clearSignal, userId]);

  const saveDraft = useCallback((data: CadProjectData) => {
    if (!userId) return;
    const key = localProjectDraftKey(userId);
    if (timer.current) window.clearTimeout(timer.current);
    const pendingTimer = pendingDraftTimers.get(key);
    if (pendingTimer) window.clearTimeout(pendingTimer);
    setLocalDraftDirty(true);
    timer.current = window.setTimeout(() => {
      try {
        const draft: LocalProjectDraft = { projectId: projectId || null, data: compactDraftData(data), updatedAt: new Date().toISOString() };
        window.localStorage.setItem(key, JSON.stringify(draft));
        pendingDraftTimers.delete(key);
        setLocalDraftDirty(false);
      } catch {
        // The backend autosave remains the source of truth if storage is full or unavailable.
        setLocalDraftDirty(false);
      }
    }, LOCAL_DRAFT_DELAY_MS);
    pendingDraftTimers.set(key, timer.current);
  }, [projectId, userId]);

  const clearDraft = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    clearLocalProjectDraft(userId);
    setRestoredDraft(null);
    setLocalDraftDirty(false);
  }, [userId]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return { restoredDraft, localDraftDirty, saveDraft, clearDraft };
}
