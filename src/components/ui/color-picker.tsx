import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export const ColorPicker = ({ color, onChange, disabled }: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-10 p-1"
          disabled={disabled}
        >
          <div
            className="w-full h-full rounded"
            style={{ backgroundColor: color || "#4a5d23" }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <HexColorPicker color={color || "#4a5d23"} onChange={onChange} />
        <div className="mt-2 grid grid-cols-6 gap-1">
          {/* Military-inspired pastel presets */}
          {[
            "#7d8c5c", // Olive green
            "#c4b7a6", // Sandy beige  
            "#d4a574", // Warm tan
            "#8b7355", // Khaki brown
            "#9caf88", // Sage green
            "#bf8b67", // Burnt orange
            "#6b7b4c", // Army green
            "#b8a088", // Desert sand
            "#a3b18a", // Soft olive
            "#c9a66b", // Golden wheat
            "#7c6f5d", // Camouflage brown
            "#8fa876", // Moss green
          ].map((preset) => (
            <button
              key={preset}
              className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: preset }}
              onClick={() => onChange(preset)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
