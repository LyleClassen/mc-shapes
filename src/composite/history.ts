import type { Composite } from "./composite";

/** How many undo steps are kept; the oldest is dropped first. */
export const HISTORY_LIMIT = 100;

/** One undo step: the composite either side of it, and the layer it changed (null for several or none). */
export interface Step {
  before: Composite;
  after: Composite;
  affected: string | null;
}

/**
 * Linear undo history, in memory only. `merge` is the key of the field edit
 * that is still open: another edit with the same key folds into the last step.
 */
export interface History {
  past: readonly Step[];
  future: readonly Step[];
  merge: string | null;
}

export const EMPTY_HISTORY: History = { past: [], future: [], merge: null };

/** True when both composites flatten from the same canvas and layers. Layers are immutable, so most compare by reference. */
export function sameComposite(a: Composite, b: Composite): boolean {
  if (a === b) return true;
  if (a.canvas.width !== b.canvas.width || a.canvas.height !== b.canvas.height) return false;
  if (a.layers.length !== b.layers.length) return false;
  return a.layers.every((l, i) => l === b.layers[i] || JSON.stringify(l) === JSON.stringify(b.layers[i]));
}

/**
 * Records a change as one step and clears redo. A change that leaves the
 * composite as it was records nothing. With a `merge` key matching the open
 * one (typing in, or nudging, the same field on the same layer), the change
 * folds into the last step instead.
 */
export function record(
  history: History,
  before: Composite,
  after: Composite,
  affected: string | null,
  merge: string | null = null,
): History {
  const last = history.past.at(-1);
  if (merge !== null && merge === history.merge && last) {
    const rest = history.past.slice(0, -1);
    // Typed back to where the field started: the step undoes nothing, so drop it.
    if (sameComposite(last.before, after)) return { past: rest, future: [], merge: null };
    return { past: [...rest, { ...last, after }], future: [], merge };
  }
  if (sameComposite(before, after)) return merge === history.merge ? history : { ...history, merge: null };
  const past = [...history.past, { before, after, affected }].slice(-HISTORY_LIMIT);
  return { past, future: [], merge };
}

/** Ends the open field edit, so the next edit starts a new step. */
export function seal(history: History): History {
  return history.merge === null ? history : { ...history, merge: null };
}

export interface Travel {
  history: History;
  composite: Composite;
  step: Step;
}

/** Steps back one, or null when there's nothing to undo. */
export function undo(history: History): Travel | null {
  const step = history.past.at(-1);
  if (!step) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, step], merge: null },
    composite: step.before,
    step,
  };
}

/** Steps forward one, or null when there's nothing to redo. */
export function redo(history: History): Travel | null {
  const step = history.future.at(-1);
  if (!step) return null;
  return {
    history: { past: [...history.past, step], future: history.future.slice(0, -1), merge: null },
    composite: step.after,
    step,
  };
}

/**
 * The layer to select after moving from `from` to `to` through a step: the
 * layer it affected, or if that's gone, the nearest layer below it that's
 * still there, or none. Steps on several layers or none keep `current`.
 */
export function selectionAfter(
  affected: string | null,
  from: Composite,
  to: Composite,
  current: string | null,
): string | null {
  if (affected === null) return current;
  const present = new Set(to.layers.map(l => l.id));
  if (present.has(affected)) return affected;
  const i = from.layers.findIndex(l => l.id === affected);
  for (let j = i - 1; j >= 0; j--) {
    const id = from.layers[j]!.id;
    if (present.has(id)) return id;
  }
  return null;
}
