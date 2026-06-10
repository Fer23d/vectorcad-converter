"use client";

import { useCallback, useEffect, useState } from "react";

interface ResizablePanelOptions {
  initialSize: number;
  minSize: number;
  maxSize: () => number;
  storageKey: string;
}

export function useResizablePanel({ initialSize, minSize, maxSize, storageKey }: ResizablePanelOptions) {
  const [size, setSize] = useState(initialSize);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(saved) && saved > 0) setSize(Math.max(minSize, Math.min(saved, maxSize())));
    });
    return () => cancelAnimationFrame(frame);
  }, [maxSize, minSize, storageKey]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (event: PointerEvent) => {
      const next = Math.max(minSize, Math.min(event.clientX, maxSize()));
      setSize(next);
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
  }, [maxSize, minSize, resizing, storageKey]);

  const startResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setResizing(true);
  }, []);

  return { size, resizing, startResize };
}
