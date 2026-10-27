import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionState } from "../useSessionState";
import { duplicateLayer, EMPTY_COMPOSITE, resizeCanvas, type Canvas, type Composite, type Layer } from "./composite";
import { insertLayer, neighbourOf, removeLayer, reorderLayer } from "./edit";
import { EMPTY_HISTORY, record, redo, seal, selectionAfter, undo, type History, type Travel } from "./history";

export type Tool = "move" | "line" | "eraser";

/** Eraser options, remembered for the session but not stored on any layer. */
export interface ToolOptions {
  brushSize: number;
  eraserShape: "brush" | "rect";
  eraseMode: "erase" | "restore";
}

const DEFAULT_OPTIONS: ToolOptions = { brushSize: 2, eraserShape: "brush", eraseMode: "erase" };

/**
 * The composite being edited, its undo history and the editor's view state.
 * The composite lives in sessionStorage; the history is in memory only, so a
 * reload restores the composite with nothing to undo. Keyboard undo/redo only
 * listens while `active` (Composite mode is showing).
 */
export function useComposite(active: boolean) {
  const [composite, setComposite] = useSessionState<Composite>("composite", EMPTY_COMPOSITE, isComposite);
  const [history, setHistory] = useState<History>(EMPTY_HISTORY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useSessionState<Tool>("compositeTool", "move", v => v === "move" || v === "line" || v === "eraser");
  const [options, setOptions] = useSessionState<ToolOptions>("compositeToolOptions", DEFAULT_OPTIONS, isOptions);
  const [notice, setNotice] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // Event handlers read and write these synchronously, so a gesture's many
  // pointer moves never see a stale composite.
  const present = useRef(composite);
  const past = useRef(history);
  const selection = useRef(selectedId);
  selection.current = selectedId;
  const gesture = useRef<{ start: Composite; affected: string | null } | null>(null);

  const show = (next: Composite) => {
    present.current = next;
    setComposite(next);
  };
  const keep = (next: History) => {
    past.current = next;
    setHistory(next);
  };

  /** One change, recorded as one step; back-to-back changes with the same `merge` key fold together. */
  const edit = useCallback((change: (c: Composite) => Composite, affected: string | null, merge?: string) => {
    const before = present.current;
    const after = change(before);
    keep(record(past.current, before, after, affected, merge ?? null));
    show(after);
  }, []);

  /** Starts a gesture: preview freely, then `end` records it as one step. */
  const begin = useCallback((affected: string | null) => {
    gesture.current = { start: present.current, affected };
  }, []);
  const preview = useCallback((change: (c: Composite) => Composite) => show(change(present.current)), []);
  const end = useCallback((affected?: string | null) => {
    const g = gesture.current;
    gesture.current = null;
    if (g) keep(record(past.current, g.start, present.current, affected === undefined ? g.affected : affected));
  }, []);

  const travel = useCallback((go: (h: History) => Travel | null) => {
    if (gesture.current) return;
    const t = go(past.current);
    if (!t) return;
    const from = present.current;
    keep(t.history);
    show(t.composite);
    setSelectedId(selectionAfter(t.step.affected, from, t.composite, selection.current));
  }, []);
  const undoStep = useCallback(() => travel(undo), [travel]);
  const redoStep = useCallback(() => travel(redo), [travel]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTextField(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) undoStep();
      else if ((key === "z" && e.shiftKey) || key === "y") redoStep();
      else return;
      e.preventDefault();
    };
    // Touching anything else ends a run of merged field edits. Not on focus: a
    // slider takes focus after its first change, which would split the scrub.
    const onTouch = () => {
      if (past.current.merge !== null) past.current = seal(past.current);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onTouch, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onTouch, true);
    };
  }, [active, undoStep, redoStep]);

  const say = useCallback((message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(n => (n === message ? null : n)), 2600);
  }, []);

  /** Briefly tints a layer picked on the canvas. */
  const flash = useCallback((id: string) => {
    setFlashId(id);
    setTimeout(() => setFlashId(f => (f === id ? null : f)), 450);
  }, []);

  const selected = composite.layers.find(l => l.id === selectedId) ?? null;

  const updateLayer = (id: string, change: (l: Layer) => Layer, merge?: string) =>
    edit(c => ({ ...c, layers: c.layers.map(l => (l.id === id ? change(l) : l)) }), id, merge && `${id}:${merge}`);

  /** Adds a layer above the selection (or on top) and selects it. */
  const addLayer = (layer: Layer) => {
    edit(c => insertLayer(c, layer, selection.current), layer.id);
    setSelectedId(layer.id);
  };

  const deleteLayer = (id: string) => {
    const next = neighbourOf(present.current, id);
    edit(c => removeLayer(c, id), id);
    if (selection.current === id) setSelectedId(next);
  };

  const duplicate = (id: string) => {
    const layer = present.current.layers.find(l => l.id === id);
    if (!layer) return;
    const copy = duplicateLayer(present.current, layer);
    edit(c => insertLayer(c, copy, id), copy.id);
    setSelectedId(copy.id);
  };

  const reorder = (id: string, index: number) => edit(c => reorderLayer(c, id, index), null);

  const resize = (size: Canvas, merge: string) => edit(c => resizeCanvas(c, size), null, `canvas:${merge}`);

  return {
    composite,
    selected,
    selectedId,
    select: setSelectedId,
    tool,
    setTool,
    options,
    setOptions,
    edit,
    begin,
    preview,
    end,
    undo: undoStep,
    redo: redoStep,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    updateLayer,
    addLayer,
    deleteLayer,
    duplicate,
    reorder,
    resize,
    notice,
    say,
    flashId,
    flash,
  };
}

export type CompositeApi = ReturnType<typeof useComposite>;

/** Fields where Ctrl+Z is the browser's own text undo. */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && ["text", "number", "search"].includes(target.type);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Enough of a check that a stale or hand-edited sessionStorage value can't crash the flatten. */
function isComposite(v: unknown): boolean {
  if (!isObject(v) || !isObject(v.canvas) || !Array.isArray(v.layers)) return false;
  if (typeof v.canvas.width !== "number" || typeof v.canvas.height !== "number") return false;
  return v.layers.every(
    l =>
      isObject(l) &&
      typeof l.id === "string" &&
      typeof l.x === "number" &&
      typeof l.y === "number" &&
      ((l.kind === "shape" && typeof l.shapeId === "string" && isObject(l.values)) ||
        (l.kind === "line" && isObject(l.a) && isObject(l.b)) ||
        (l.kind === "eraser" && Array.isArray(l.cells)) ||
        (l.kind === "image" && isMask(l.mask) && isObject(l.values))),
  );
}

const isMask = (m: unknown) =>
  isObject(m) && typeof m.id === "string" && typeof m.bits === "string" && typeof m.width === "number" && typeof m.height === "number";

function isOptions(v: unknown): boolean {
  return (
    isObject(v) &&
    typeof v.brushSize === "number" &&
    (v.eraserShape === "brush" || v.eraserShape === "rect") &&
    (v.eraseMode === "erase" || v.eraseMode === "restore")
  );
}
