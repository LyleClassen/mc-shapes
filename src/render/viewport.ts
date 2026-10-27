/** The part of a stage's content that's on screen, in content pixels. */
export interface View {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The part of `content` that shows through the scrolling `stage`, in content pixels. */
export function visibleView(stage: HTMLElement, content: HTMLElement): View {
  const s = stage.getBoundingClientRect(), r = content.getBoundingClientRect();
  const left = s.left + stage.clientLeft, top = s.top + stage.clientTop;
  const x0 = Math.max(0, Math.floor(left - r.left)), y0 = Math.max(0, Math.floor(top - r.top));
  const x1 = Math.min(Math.ceil(r.width), Math.ceil(left + stage.clientWidth - r.left));
  const y1 = Math.min(Math.ceil(r.height), Math.ceil(top + stage.clientHeight - r.top));
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}

/**
 * Sizes an absolutely placed canvas to cover just `view` of its content, so
 * big builds never need a bitmap bigger than the screen. The context draws in
 * content pixels.
 */
export function fitCanvas(canvas: HTMLCanvasElement, view: View): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(view.width * dpr));
  canvas.height = Math.max(1, Math.round(view.height * dpr));
  canvas.style.left = `${view.x}px`;
  canvas.style.top = `${view.y}px`;
  canvas.style.width = `${view.width}px`;
  canvas.style.height = `${view.height}px`;
  const ctx = canvas.getContext("2d");
  ctx?.setTransform(dpr, 0, 0, dpr, -view.x * dpr, -view.y * dpr);
  return ctx;
}
