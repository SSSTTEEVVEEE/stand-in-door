import { SecureKeyboard } from "@/components/SecureKeyboard";
import { useSecureKeyboard } from "@/contexts/SecureKeyboardContext";
import { useIsMobile } from "@/hooks/use-mobile";

export const GlobalSecureKeyboard = () => {
  const isMobile = useIsMobile();
  const {
    isKeyboardVisible,
    inputType,
    handleKeyPress,
    handleDelete,
    handleSubmit,
    isAuthPage,
  } = useSecureKeyboard();

  if (!isMobile) return null;

  return (
    <SecureKeyboard
      visible={isKeyboardVisible}
      onKeyPress={handleKeyPress}
      onDelete={handleDelete}
      onSubmit={handleSubmit}
      inputType={inputType}
      zeroFeedback={!isAuthPage}
    />
  );
};
