import { DownloadIcon } from "lucide-react";
import { exportBlock, exportParams, litematicFile, type Orientation } from "../export/litematic";
import type { Grid, Span } from "../shapes/grid";
import type { ParamValue, ParamValues } from "../shapes/types";
import { ParamControls } from "./ParamControls";
import { Button } from "@/components/ui/button";
import { FieldDescription } from "@/components/ui/field";

/** The export options, shared by both modes. */
export interface ExportSettings {
  values: ParamValues;
  onChange: (key: string, value: ParamValue) => void;
}

interface Props extends ExportSettings {
  grid: Grid;
  /** Names the schematic and the downloaded file. */
  name: string;
  /** The plan's centre block(s), for the "Include centre blocks" option. */
  center: { x: Span; y: Span } | null;
}

/** Downloads the block plan as a Litematica schematic in one chosen block. */
export function ExportPanel({ grid, name, center, values, onChange }: Props) {
  const download = async () => {
    const file = await litematicFile(grid, {
      name,
      block: exportBlock(String(values.block)),
      orientation: values.orientation as Orientation,
      center: values.center && center ? center : undefined,
    });
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(name)}-${grid.width}x${grid.height}.litematic`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <ParamControls params={exportParams} values={values} onChange={onChange} />
      <Button className="self-start" disabled={!grid.width} onClick={download}>
        <DownloadIcon />
        Download .litematic
      </Button>
      {values.center && (
        <FieldDescription>Gold blocks mark the centre for lining up the build; break them once it's placed.</FieldDescription>
      )}
      <FieldDescription>Open it from Litematica's schematic browser to place it as a hologram.</FieldDescription>
    </div>
  );
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan";
