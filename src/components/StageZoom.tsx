import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";

/** Smallest and largest block size, in CSS pixels. Below 2px is only for fitting big builds. */
const MIN_CELL = 0.25;
const MAX_CELL = 48;

/** Whole pixels from 2px up so blocks stay crisp; two decimals below that. */
const normalize = (c: number) => (c >= 2 ? Math.round(c) : Math.round(c * 100) / 100);

/**
 * Zoom for a scrolling stage whose content is `cols` × `rows` blocks. Starts
 * at Fit; zooming from the slider keeps the middle of the view still, and
 * Ctrl/⌘ + scroll (or a trackpad pinch) zooms around the pointer. Declare it
 * before the stage's draw effects so they see the new scroll position.
 */
export function useStageZoom(
  stageRef: React.RefObject<HTMLElement | null>,
  contentRef: React.RefObject<HTMLElement | null>,
  cols: number,
  rows: number,
  /** Padding inside the stage, kept clear when fitting. */
  padding: number,
) {
  const stageSize = useElementSize(stageRef);
  const [zoom, setZoom] = useState<number | null>(null);
  // The content point under `px, py` (client coordinates) that should stay put after a zoom.
  const anchor = useRef<{ col: number; row: number; px: number; py: number } | null>(null);

  const fit = Math.min((stageSize.width - padding * 2) / Math.max(cols, 1), (stageSize.height - padding * 2) / Math.max(rows, 1));
  const fitCell = Math.max(MIN_CELL, fit >= 2 ? Math.floor(fit) : fit);
  const minCell = Math.min(2, fitCell);
  const clamp = (c: number) => Math.min(MAX_CELL, Math.max(minCell, c));
  const cell = normalize(clamp(zoom ?? fitCell));

  const zoomTo = (next: number, at?: { clientX: number; clientY: number }) => {
    const stage = stageRef.current, content = contentRef.current;
    if (stage && content) {
      const s = stage.getBoundingClientRect(), r = content.getBoundingClientRect();
      const px = at?.clientX ?? s.left + s.width / 2, py = at?.clientY ?? s.top + s.height / 2;
      anchor.current = { col: (px - r.left) / cell, row: (py - r.top) / cell, px, py };
    }
    setZoom(clamp(next));
  };

  useLayoutEffect(() => {
    const a = anchor.current, stage = stageRef.current, content = contentRef.current;
    anchor.current = null;
    if (!a || !stage || !content) return;
    const r = content.getBoundingClientRect();
    stage.scrollLeft += r.left + a.col * cell - a.px;
    stage.scrollTop += r.top + a.row * cell - a.py;
  }, [cell, zoom, stageRef, contentRef]);

  // React's onWheel is passive, so Ctrl + scroll can't stop the page zooming from there.
  const wheel = useRef<(e: WheelEvent) => void>(() => {});
  wheel.current = e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomTo((zoom ?? cell) * Math.exp(-e.deltaY * 0.002), e);
  };
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => wheel.current(e);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stageRef]);

  return { cell, minCell, fitted: zoom === null, stageSize, zoomTo, fit: () => setZoom(null) };
}

export type StageZoom = ReturnType<typeof useStageZoom>;

/** The Fit chip and zoom slider; the slider is logarithmic so small sizes get room too. */
export function ZoomControls({ zoom }: { zoom: StageZoom }) {
  return (
    <>
      <Toggle variant="chip" pressed={zoom.fitted} onPressedChange={zoom.fit}>
        Fit
      </Toggle>
      <Label className="min-w-[180px] grow text-[13px] text-secondary-foreground" title="Ctrl + scroll on the canvas to zoom at the pointer">
        Zoom
        <Slider
          tone="diamond"
          min={Math.log2(zoom.minCell)}
          max={Math.log2(MAX_CELL)}
          step={0.01}
          value={Math.log2(zoom.cell)}
          onValueChange={v => zoom.zoomTo(2 ** (v as number))}
        />
        <span className="min-w-[38px] text-right font-mono text-xs text-diamond">{zoom.cell}px</span>
      </Label>
    </>
  );
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 600, height: 500 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
