"use client";

import { useCallback, useEffect, useState } from "react";

interface ResizablePanelOptions {
  initialSize: number;
  minSize: number;
  maxSize: () => number;
  storageKey: string;
  edge?: "left" | "right";
  onSizeChange?: (size: number) => void;
}

export function useResizablePanel({ initialSize, minSize, maxSize, storageKey, edge = "left", onSizeChange }: ResizablePanelOptions) {
  const [size, setSize] = useState(initialSize);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = Number(localStorage.getItem(storageKey));
      const next = Number.isFinite(saved) && saved > 0 ? Math.max(minSize, Math.min(saved, maxSize())) : initialSize;
      setSize(next);
      onSizeChange?.(next);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialSize, maxSize, minSize, onSizeChange, storageKey]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (event: PointerEvent) => {
      const pointerSize = edge === "right" ? window.innerWidth - event.clientX : event.clientX;
      const next = Math.max(minSize, Math.min(pointerSize, maxSize()));
      setSize(next);
      onSizeChange?.(next);
      localStorage.setItem(storageKey, String(Math.round(next)));
    };
    const onUp = () => setResizing(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    document.body.classList.add("resizing-panel");
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("resizing-panel");
    };
  }, [edge, maxSize, minSize, onSizeChange, resizing, storageKey]);

  const startResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setResizing(true);
  }, []);

  return { size, resizing, startResize };
}
