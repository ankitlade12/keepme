"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eraser, Paintbrush, Redo2, RotateCcw, Trash2 } from "lucide-react";
import type { ContractProtection, PreserveZone } from "@/lib/types";

type Point = { x: number; y: number };
type Stroke = { id: string; points: Point[] };
type Tool = "brush" | "erase";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function glassesStroke(): Stroke {
  const points = Array.from({ length: 33 }, (_, index) => {
    const angle = (index / 32) * Math.PI * 2;
    return { x: 0.5 + Math.cos(angle) * 0.105, y: 0.21 + Math.sin(angle) * 0.035 };
  });
  return { id: `zone_${crypto.randomUUID().slice(0, 8)}`, points };
}

function strokeToZone(stroke: Stroke, index: number): PreserveZone {
  const xs = stroke.points.map((point) => point.x);
  const ys = stroke.points.map((point) => point.y);
  const padding = 0.018;
  const left = clamp(Math.min(...xs) - padding);
  const top = clamp(Math.min(...ys) - padding);
  const right = clamp(Math.max(...xs) + padding);
  const bottom = clamp(Math.max(...ys) + padding);
  return {
    zoneId: stroke.id,
    label: index === 0 ? "Primary preserve zone" : `Preserve zone ${index + 1}`,
    x: left,
    y: top,
    width: Math.max(0.01, right - left),
    height: Math.max(0.01, bottom - top),
    critical: true,
  };
}

function pointDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function PreserveMap({
  imageUrl,
  protections,
  onZonesChange,
  presetRequest,
}: {
  imageUrl: string;
  protections: ContractProtection[];
  onZonesChange: (zones: PreserveZone[]) => void;
  presetRequest: number;
}) {
  const [tool, setTool] = useState<Tool>("brush");
  const [strokes, setStrokes] = useState<Stroke[]>(() => [glassesStroke()]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const history = useRef<Stroke[][]>([]);
  const future = useRef<Stroke[][]>([]);
  const erasing = useRef(false);
  const lastPresetRequest = useRef(presetRequest);

  const zones = useMemo(() => strokes.filter((stroke) => stroke.points.length > 1).map(strokeToZone), [strokes]);
  const activeProtectionCount = protections.filter((protection) => protection.enabled).length;

  useEffect(() => onZonesChange(zones), [onZonesChange, zones]);

  useEffect(() => {
    if (presetRequest === lastPresetRequest.current) return;
    lastPresetRequest.current = presetRequest;
    commit([glassesStroke()]);
    // The request counter is the event; the current stroke list is intentionally read here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetRequest]);

  function commit(next: Stroke[]) {
    history.current.push(strokes);
    future.current = [];
    setStrokes(next);
  }

  function toPoint(event: React.PointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  }

  function eraseAt(point: Point) {
    setStrokes((current) => current.filter((stroke) => !stroke.points.some((candidate) => pointDistance(candidate, point) < 0.055)));
  }

  function pointerDown(event: React.PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toPoint(event);
    if (tool === "erase") {
      history.current.push(strokes);
      future.current = [];
      erasing.current = true;
      eraseAt(point);
      return;
    }
    setActiveStroke({ id: `zone_${crypto.randomUUID().slice(0, 8)}`, points: [point] });
  }

  function pointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const point = toPoint(event);
    if (erasing.current) {
      eraseAt(point);
      return;
    }
    setActiveStroke((current) => current ? { ...current, points: [...current.points, point] } : null);
  }

  function pointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (erasing.current) {
      erasing.current = false;
      return;
    }
    if (activeStroke && activeStroke.points.length > 1) commit([...strokes, activeStroke]);
    setActiveStroke(null);
  }

  function undo() {
    const previous = history.current.pop();
    if (!previous) return;
    future.current.push(strokes);
    setStrokes(previous);
  }

  function redo() {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(strokes);
    setStrokes(next);
  }

  function clear() {
    if (strokes.length) commit([]);
  }

  return (
    <div className="preserve-map">
      {/* Object URLs and provider-returned images cannot be optimized by next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Selected source with editable permitted and protected regions" draggable={false} />
      <div className="allowed-region" aria-label="Permitted upper-body garment region" />
      <svg
        className={`preserve-canvas tool-${tool}`}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${zones.length} custom preserve zone${zones.length === 1 ? "" : "s"}. Draw with the brush or remove a zone with the eraser.`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        {[...strokes, ...(activeStroke ? [activeStroke] : [])].map((stroke) => (
          <polyline
            key={stroke.id}
            points={stroke.points.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ")}
            className="preserve-stroke"
          />
        ))}
      </svg>
      <div className="map-status" aria-live="polite">
        <strong>{zones.length} custom zone{zones.length === 1 ? "" : "s"}</strong>
        <span>{activeProtectionCount} default protections active</span>
      </div>
      <div className="map-toolbar" aria-label="Preserve zone tools">
        <button type="button" className={`icon-btn ${tool === "brush" ? "active" : ""}`} aria-label="Brush preserve zone" aria-pressed={tool === "brush"} title="Brush" onClick={() => setTool("brush")}><Paintbrush size={16} /></button>
        <button type="button" className={`icon-btn ${tool === "erase" ? "active" : ""}`} aria-label="Erase preserve zone" aria-pressed={tool === "erase"} title="Erase" onClick={() => setTool("erase")}><Eraser size={16} /></button>
        <button type="button" className="icon-btn" aria-label="Undo" title="Undo" disabled={!history.current.length} onClick={undo}><RotateCcw size={16} /></button>
        <button type="button" className="icon-btn" aria-label="Redo" title="Redo" disabled={!future.current.length} onClick={redo}><Redo2 size={16} /></button>
        <button type="button" className="icon-btn" aria-label="Clear custom zones" title="Clear" disabled={!strokes.length} onClick={clear}><Trash2 size={16} /></button>
      </div>
    </div>
  );
}
