/**
 * PROTOTYPE, throwaway. Composite state, tools and undo/redo for the layout
 * prototype. In memory only: a reload starts empty.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_COMPOSITE, makeShapeLayer, type Composite, type Layer } from "./engine";

export type Tool = "move" | "shape" | "line" | "eraser";

export interface ToolOptions {
  placeShapeId: string;
  brushSize: number;
  eraserShape: "brush" | "rect";
  eraseMode: "erase" | "restore";
}

interface Step {
  composite: Composite;
  /** The layer this step changed, selected again on undo/redo. */
  affected: string | null;
}

const LIMIT = 100;

function seed(): Composite {
  const c: Composite = { ...EMPTY_COMPOSITE, layers: [] };
  const circle = makeShapeLayer(c, "circle");
  c.layers.push({ ...circle, values: { ...circle.values }, fill: { fill: "hollow", thickness: 2 } });
  const rect = makeShapeLayer(c, "rectangle", { x: 40, y: 40 });
  c.layers.push(rect);
  return c;
}

export function useComposite() {
  const [composite, setComposite] = useState<Composite>(seed);
  const [past, setPast] = useState<Step[]>([]);
  const [future, setFuture] = useState<Step[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("move");
  const [toolOpts, setToolOpts] = useState<ToolOptions>({
    placeShapeId: "circle",
    brushSize: 2,
    eraserShape: "brush",
    eraseMode: "erase",
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const present = useRef(composite);
  present.current = composite;
  const gesture = useRef<{ start: Composite; affected: string | null } | null>(null);
  const mergeKey = useRef<string | null>(null);

  const push = (before: Composite, affected: string | null) => {
    setPast(p => [...p.slice(-(LIMIT - 1)), { composite: before, affected }]);
    setFuture([]);
  };

  /** One immediate step. Same `merge` key back to back folds into one step. */
  const edit = useCallback((fn: (c: Composite) => Composite, affected: string | null, merge?: string) => {
    const before = present.current;
    const next = fn(before);
    if (next === before || JSON.stringify(next) === JSON.stringify(before)) return;
    if (!(merge && merge === mergeKey.current)) push(before, affected);
    mergeKey.current = merge ?? null;
    setComposite(next);
  }, []);

  /** Gestures: preview freely, commit one step on release. */
  const begin = useCallback((affected: string | null) => {
    gesture.current = { start: present.current, affected };
    mergeKey.current = null;
  }, []);
  const preview = useCallback((fn: (c: Composite) => Composite) => setComposite(c => fn(c)), []);
  const end = useCallback(() => {
    const g = gesture.current;
    gesture.current = null;
    if (g && JSON.stringify(g.start) !== JSON.stringify(present.current)) push(g.start, g.affected);
  }, []);

  const travel = (from: Step[], to: (s: (x: Step[]) => Step[]) => void, setFrom: (s: (x: Step[]) => Step[]) => void) => {
    if (gesture.current || !from.length) return;
    const step = from[from.length - 1]!;
    setFrom(x => x.slice(0, -1));
    to(x => [...x, { composite: present.current, affected: step.affected }]);
    mergeKey.current = null;
    setComposite(step.composite);
    if (step.affected) {
      const i = step.composite.layers.findIndex(l => l.id === step.affected);
      setSelectedId(i >= 0 ? step.affected : (step.composite.layers[Math.max(0, i - 1)]?.id ?? null));
    }
  };
  const undo = () => travel(past, setFuture, setPast);
  const redo = () => travel(future, setPast, setFuture);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const say = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(n => (n === msg ? null : n)), 2600);
  }, []);
  const flash = useCallback((id: string) => {
    setFlashId(id);
    setTimeout(() => setFlashId(f => (f === id ? null : f)), 450);
  }, []);

  const selected = composite.layers.find(l => l.id === selectedId) ?? null;

  const updateLayer = (id: string, fn: (l: Layer) => Layer, merge?: string) =>
    edit(c => ({ ...c, layers: c.layers.map(l => (l.id === id ? fn(l) : l)) }), id, merge && `${id}:${merge}`);

  const addLayer = (layer: Layer) => {
    edit(c => {
      // New layers go above the selection, or on top.
      const i = c.layers.findIndex(l => l.id === selectedId);
      const layers = [...c.layers];
      layers.splice(i >= 0 ? i + 1 : layers.length, 0, layer);
      return { ...c, layers };
    }, layer.id);
    setSelectedId(layer.id);
  };

  const removeLayer = (id: string) => {
    const i = composite.layers.findIndex(l => l.id === id);
    edit(c => ({ ...c, layers: c.layers.filter(l => l.id !== id) }), id);
    if (selectedId === id) setSelectedId(composite.layers[i - 1]?.id ?? null);
  };

  const duplicateLayer = (id: string) => {
    const l = composite.layers.find(x => x.id === id);
    if (!l) return;
    addLayer({ ...structuredClone(l), id: `${l.id}c${Date.now().toString(36)}`, name: `${l.name} copy` });
  };

  /** Move a layer to index `to` (0 = bottom). */
  const reorder = (id: string, to: number) =>
    edit(c => {
      const layers = c.layers.filter(l => l.id !== id);
      const l = c.layers.find(x => x.id === id)!;
      layers.splice(Math.max(0, Math.min(layers.length, to)), 0, l);
      return { ...c, layers };
    }, null);

  const resize = (width: number, height: number) =>
    edit(c => ({ ...c, width, height }), null, "canvas");

  return {
    composite,
    selected,
    selectedId,
    setSelectedId,
    tool,
    setTool,
    toolOpts,
    setToolOpts,
    edit,
    begin,
    preview,
    end,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    updateLayer,
    addLayer,
    removeLayer,
    duplicateLayer,
    reorder,
    resize,
    notice,
    say,
    flashId,
    flash,
  };
}

export type CompositeApi = ReturnType<typeof useComposite>;
