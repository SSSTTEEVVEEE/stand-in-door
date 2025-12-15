import { useEffect, useRef, useId } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SecureInput } from "@/components/SecureInput";
import { useSecureKeyboard } from "@/contexts/SecureKeyboardContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, stripWatermarkChars } from "@/lib/utils";

interface SecureTextareaWrapperProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
}

export const SecureTextareaWrapper = ({
  value,
  onChange,
  placeholder,
  id,
  className,
  required,
  disabled,
  rows = 3,
}: SecureTextareaWrapperProps) => {
  const isMobile = useIsMobile();
  const uniqueId = useId();
  const fieldId = id || uniqueId;
  const valueRef = useRef(value);
  
  // Keep valueRef in sync
  valueRef.current = value;

  const { 
    registerInput, 
    unregisterInput, 
    showKeyboard, 
    activeField 
  } = useSecureKeyboard();

  useEffect(() => {
    if (isMobile) {
      registerInput(
        fieldId,
        (newValue) => {
          const syntheticEvent = {
            target: { value: newValue },
          } as React.ChangeEvent<HTMLTextAreaElement>;
          onChange(syntheticEvent);
        },
        () => valueRef.current,
        "text"
      );

      return () => {
        unregisterInput(fieldId);
      };
    }
  }, [fieldId, isMobile, onChange, registerInput, unregisterInput]);

  // On desktop, use standard Textarea
  if (!isMobile) {
    return (
      <Textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        required={required}
        disabled={disabled}
        rows={rows}
      />
    );
  }

  // On mobile, use a custom secure textarea display
  const isFocused = activeField === fieldId;
  const cleanValue = stripWatermarkChars(value);

  return (
    <div
      id={fieldId}
      role="textbox"
      aria-label="Text input"
      aria-multiline="true"
      tabIndex={0}
      onTouchStart={(e) => {
        e.preventDefault();
        showKeyboard(fieldId, "text");
      }}
      onClick={(e) => {
        e.preventDefault();
        showKeyboard(fieldId, "text");
      }}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "font-mono cursor-text select-none",
        isFocused && "ring-2 ring-ring ring-offset-2",
        className
      )}
      style={{
        WebkitTapHighlightColor: "transparent",
        WebkitTouchCallout: "none",
        userSelect: "none",
        minHeight: `${rows * 1.5 + 1}rem`,
      }}
    >
      <span className="flex-1 whitespace-pre-wrap">
        {cleanValue ? (
          <span className="text-foreground">{cleanValue}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        {isFocused && (
          <span className="inline-block w-0.5 h-5 bg-foreground ml-0.5 animate-pulse" />
        )}
      </span>
    </div>
  );
};

