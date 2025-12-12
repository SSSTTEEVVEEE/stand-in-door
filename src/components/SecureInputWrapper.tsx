import { useEffect, useRef, useId } from "react";
import { Input } from "@/components/ui/input";
import { SecureInput } from "@/components/SecureInput";
import { useSecureKeyboard } from "@/contexts/SecureKeyboardContext";
import { useIsMobile } from "@/hooks/use-mobile";

interface SecureInputWrapperProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: "text" | "email" | "password" | "number" | "date" | "time";
  placeholder?: string;
  id?: string;
  className?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const SecureInputWrapper = ({
  value,
  onChange,
  type = "text",
  placeholder,
  id,
  className,
  required,
  minLength,
  disabled,
  autoFocus,
}: SecureInputWrapperProps) => {
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

  // Map input type to keyboard type
  const getKeyboardType = (): "text" | "email" | "password" => {
    if (type === "email") return "email";
    if (type === "password") return "password";
    return "text";
  };
  
  const keyboardType = getKeyboardType();
  
  // For date/time inputs, always use native input (even on mobile)
  const useNativeInput = type === "date" || type === "time";

  useEffect(() => {
    if (isMobile && !useNativeInput) {
      registerInput(
        fieldId,
        (newValue) => {
          const syntheticEvent = {
            target: { value: newValue },
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        },
        () => valueRef.current,
        keyboardType
      );

      return () => {
        unregisterInput(fieldId);
      };
    }
  }, [fieldId, isMobile, keyboardType, onChange, registerInput, unregisterInput, useNativeInput]);

  // On desktop or for date/time inputs, use standard Input
  if (!isMobile || useNativeInput) {
    return (
      <Input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        required={required}
        minLength={minLength}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    );
  }

  // On mobile, use SecureInput with keyboard context
  return (
    <SecureInput
      id={fieldId}
      type={keyboardType}
      value={value}
      onChange={(newValue) => {
        const syntheticEvent = {
          target: { value: newValue },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }}
      onFocus={() => showKeyboard(fieldId, keyboardType)}
      onBlur={() => {}}
      placeholder={placeholder}
      className={className}
      isFocused={activeField === fieldId}
    />
  );
};
