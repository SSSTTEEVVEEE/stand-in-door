import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { useLocation } from "react-router-dom";

type InputType = "email" | "password" | "text";

interface InputRegistration {
  setValue: (val: string) => void;
  getValue: () => string;
  type: InputType;
}

interface SecureKeyboardContextType {
  showKeyboard: (fieldId: string, type: InputType) => void;
  hideKeyboard: () => void;
  activeField: string | null;
  inputType: InputType;
  isKeyboardVisible: boolean;
  registerInput: (fieldId: string, setValue: (val: string) => void, getValue: () => string, type: InputType) => void;
  unregisterInput: (fieldId: string) => void;
  handleKeyPress: (char: string) => void;
  handleDelete: () => void;
  handleSubmit: () => void;
  isAuthPage: boolean;
}

const SecureKeyboardContext = createContext<SecureKeyboardContextType | null>(null);

export const useSecureKeyboard = () => {
  const context = useContext(SecureKeyboardContext);
  if (!context) {
    throw new Error("useSecureKeyboard must be used within SecureKeyboardProvider");
  }
  return context;
};

interface SecureKeyboardProviderProps {
  children: ReactNode;
}

export const SecureKeyboardProvider = ({ children }: SecureKeyboardProviderProps) => {
  const location = useLocation();
  const [activeField, setActiveField] = useState<string | null>(null);
  const [inputType, setInputType] = useState<InputType>("text");
  const inputsRef = useRef<Map<string, InputRegistration>>(new Map());

  const isAuthPage = location.pathname === "/auth";

  const registerInput = useCallback((
    fieldId: string, 
    setValue: (val: string) => void, 
    getValue: () => string,
    type: InputType
  ) => {
    inputsRef.current.set(fieldId, { setValue, getValue, type });
  }, []);

  const unregisterInput = useCallback((fieldId: string) => {
    inputsRef.current.delete(fieldId);
  }, []);

  const showKeyboard = useCallback((fieldId: string, type: InputType) => {
    setActiveField(fieldId);
    setInputType(type);
  }, []);

  const hideKeyboard = useCallback(() => {
    setActiveField(null);
  }, []);

  const handleKeyPress = useCallback((char: string) => {
    if (activeField) {
      const registration = inputsRef.current.get(activeField);
      if (registration) {
        const currentValue = registration.getValue();
        registration.setValue(currentValue + char);
      }
    }
  }, [activeField]);

  const handleDelete = useCallback(() => {
    if (activeField) {
      const registration = inputsRef.current.get(activeField);
      if (registration) {
        const currentValue = registration.getValue();
        registration.setValue(currentValue.slice(0, -1));
      }
    }
  }, [activeField]);

  const handleSubmit = useCallback(() => {
    setActiveField(null);
  }, []);

  return (
    <SecureKeyboardContext.Provider
      value={{
        showKeyboard,
        hideKeyboard,
        activeField,
        inputType,
        isKeyboardVisible: activeField !== null,
        registerInput,
        unregisterInput,
        handleKeyPress,
        handleDelete,
        handleSubmit,
        isAuthPage,
      }}
    >
      {children}
    </SecureKeyboardContext.Provider>
  );
};
