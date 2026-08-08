"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResizableVerticalPanelOptions {
  initialSize: number;
  minSize: number;
  maxSize: () => number;
  storageKey: string;
}

export function useResizableVerticalPanel({ initialSize, minSize, maxSize, storageKey }: ResizableVerticalPanelOptions) {
  const [size, setSize] = useState(initialSize);
  const [resizing, setResizing] = useState(false);
  const startY = useRef(0);
  const startSize = useRef(initialSize);

  const clamp = useCallback((value: number) => Math.max(minSize, Math.min(value, maxSize())), [maxSize, minSize]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = Number(localStorage.getItem(storageKey));
      setSize(Number.isFinite(saved) && saved > 0 ? clamp(saved) : clamp(initialSize));
    });
    return () => cancelAnimationFrame(frame);
  }, [clamp, initialSize, storageKey]);

  useEffect(() => {
    if (!resizing) return;

    const onMove = (event: PointerEvent) => {
      const next = clamp(startSize.current + event.clientY - startY.current);
      setSize(next);
      localStorage.setItem(storageKey, String(Math.round(next)));
    };
    const onUp = () => setResizing(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    document.body.classList.add("resizing-panel-vertical");

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("resizing-panel-vertical");
    };
  }, [clamp, resizing, storageKey]);

  const startResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    startY.current = event.clientY;
    startSize.current = size;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setResizing(true);
  }, [size]);

  const reset = useCallback(() => {
    const next = clamp(initialSize);
    setSize(next);
    localStorage.setItem(storageKey, String(Math.round(next)));
  }, [clamp, initialSize, storageKey]);

  return { size, resizing, startResize, reset };
}
