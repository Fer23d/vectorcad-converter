"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
const clampZoom = (value: number) => Math.max(.1, Math.min(8, value));

export function useZoomPan(storageKey: string) {
  const [zoom, setZoomState] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const origin = useRef<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(saved) && saved > 0) setZoomState(clampZoom(saved));
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  const setZoom = useCallback((value: number) => {
    const next = clampZoom(value);
    setZoomState(next);
    localStorage.setItem(storageKey, String(next));
    if (next <= 1) setPan({ x: 0, y: 0 });
  }, [storageKey]);

  const zoomBy = useCallback((amount: number) => setZoomState(current => {
    const next = clampZoom(current + amount);
    localStorage.setItem(storageKey, String(next));
    if (next <= 1) setPan({ x: 0, y: 0 });
    return next;
  }), [storageKey]);

  const fit = useCallback((container: HTMLElement | null, contentWidth: number, contentHeight: number) => {
    if (!container || !contentWidth || !contentHeight) return;
    const next = clampZoom(Math.min((container.clientWidth - 48) / contentWidth, (container.clientHeight - 48) / contentHeight));
    setPan({ x: 0, y: 0 });
    setZoom(next);
  }, [setZoom]);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0 || zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
    setPanning(true);
  }, [pan, zoom]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!panning) return;
    setPan({ x: event.clientX - origin.current.x, y: event.clientY - origin.current.y });
  }, [panning]);

  const stopPan = useCallback(() => setPanning(false), []);
  const onWheel = useCallback((event: React.WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? .15 : -.15);
  }, [zoomBy]);

  return {
    zoom, pan, panning, setZoom, zoomIn: () => zoomBy(.25), zoomOut: () => zoomBy(-.25),
    reset: () => { setPan({ x: 0, y: 0 }); setZoom(1); }, fit,
    onPointerDown, onPointerMove, onPointerUp: stopPan, onPointerCancel: stopPan, onWheel,
  };
}
