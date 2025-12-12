import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SecureInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  type: "email" | "password";
  placeholder?: string;
  id?: string;
  className?: string;
  isFocused?: boolean;
}

export const SecureInput = ({
  value,
  onChange,
  onFocus,
  onBlur,
  type,
  placeholder = "",
  id,
  className,
  isFocused = false,
}: SecureInputProps) => {
  const inputRef = useRef<HTMLDivElement>(null);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blink cursor when focused
  useEffect(() => {
    if (!isFocused) {
      setCursorVisible(false);
      return;
    }

    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 530);

    return () => clearInterval(interval);
  }, [isFocused]);

  // Display value - mask for password
  const displayValue = type === "password" ? "•".repeat(value.length) : value;

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    onFocus();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onFocus();
  };

  return (
    <div
      ref={inputRef}
      id={id}
      role="textbox"
      aria-label={type === "password" ? "Password input" : "Email input"}
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      onFocus={onFocus}
      onBlur={onBlur}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "font-mono cursor-text select-none",
        isFocused && "ring-2 ring-ring ring-offset-2",
        className
      )}
      style={{
        WebkitTapHighlightColor: "transparent",
        WebkitTouchCallout: "none",
        userSelect: "none",
      }}
    >
      <span className="flex items-center">
        {displayValue ? (
          <span className="text-foreground">{displayValue}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        {isFocused && (
          <span
            className={cn(
              "inline-block w-0.5 h-5 bg-foreground ml-0.5 transition-opacity",
              cursorVisible ? "opacity-100" : "opacity-0"
            )}
          />
        )}
      </span>
    </div>
  );
};
