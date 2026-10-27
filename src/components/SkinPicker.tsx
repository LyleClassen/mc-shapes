import type { Skin } from "../render/skins";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  skins: readonly Skin[];
  selected: string;
  onSelect: (id: string) => void;
}

export function SkinPicker({ skins, selected, onSelect }: Props) {
  return (
    <ToggleGroup
      aria-label="Block"
      variant="swatch"
      spacing={2}
      className="flex-wrap"
      value={[selected]}
      onValueChange={v => v[0] && onSelect(v[0])}
    >
      {skins.map(skin => (
        <Tooltip key={skin.id}>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value={skin.id}
                aria-label={skin.name}
                style={{ backgroundColor: skin.face, boxShadow: `inset 4px 4px 0 ${skin.light}, inset -4px -4px 0 ${skin.dark}` }}
              />
            }
          />
          <TooltipContent>{skin.name}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}
