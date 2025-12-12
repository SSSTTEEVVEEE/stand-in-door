import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

type KeyboardMode = "lowercase" | "uppercase" | "symbols";
type InputType = "email" | "password" | "text";

interface SecureKeyboardProps {
  onKeyPress: (char: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  visible: boolean;
  inputType: InputType;
  zeroFeedback?: boolean;
}

const LOWERCASE_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["⇧", "z", "x", "c", "v", "b", "n", "m", "⌫"],
  ["#+=", "SPACE", "⏎"],
];

const UPPERCASE_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["⇧", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
  ["#+=", "SPACE", "⏎"],
];

const SYMBOL_ROWS = [
  ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
  ["-", "_", "=", "+", "[", "]", "{", "}", "\\", "|"],
  [";", ":", "'", '"', ",", ".", "<", ">", "/", "?"],
  ["`", "~", "€", "£", "¥", "©", "®", "™", "⌫"],
  ["ABC", "SPACE", "⏎"],
];

// Get all key positions for fake touch events
const getAllKeyPositions = (rows: string[][]) => {
  const positions: { row: number; col: number; key: string }[] = [];
  rows.forEach((row, rowIndex) => {
    row.forEach((key, colIndex) => {
      if (key && key !== "SPACE" && !["⇧", "⌫", "⏎", "#+=", "ABC"].includes(key)) {
        positions.push({ row: rowIndex, col: colIndex, key });
      }
    });
  });
  return positions;
};

export const SecureKeyboard = ({
  onKeyPress,
  onDelete,
  onSubmit,
  visible,
  inputType,
  zeroFeedback = false,
}: SecureKeyboardProps) => {
  const [mode, setMode] = useState<KeyboardMode>("lowercase");
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getRows = () => {
    switch (mode) {
      case "uppercase":
        return UPPERCASE_ROWS;
      case "symbols":
        return SYMBOL_ROWS;
      default:
        return LOWERCASE_ROWS;
    }
  };

  // Generate cryptographically random number
  const getSecureRandom = useCallback(() => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  }, []);

  // Show key highlight (real for email, random for password, none for zero feedback)
  const showKeyHighlight = useCallback((actualKeyId: string) => {
    // Zero feedback mode - no visual indication at all
    if (zeroFeedback) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (inputType === "email") {
      // For email: show the actual key pressed
      setHighlightedKey(actualKeyId);
      timeoutRef.current = setTimeout(() => {
        setHighlightedKey(null);
      }, 100 + getSecureRandom() * 50);
    } else {
      // For password and text: show a random key with slight delay
      const delay = 20 + getSecureRandom() * 80;
      
      timeoutRef.current = setTimeout(() => {
        const rows = getRows();
        const positions = getAllKeyPositions(rows);
        const randomIndex = Math.floor(getSecureRandom() * positions.length);
        const randomPos = positions[randomIndex];
        const randomKeyId = `${randomPos.row}-${randomPos.col}`;
        
        setHighlightedKey(randomKeyId);
        
        timeoutRef.current = setTimeout(() => {
          setHighlightedKey(null);
        }, 80 + getSecureRandom() * 70);
      }, delay);
    }
  }, [inputType, getSecureRandom, mode, zeroFeedback]);

  // Handle key press with timing jitter
  const handleKeyTouch = useCallback(
    (key: string, rowIndex: number, colIndex: number, e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const keyId = `${rowIndex}-${colIndex}`;
      
      // Only show highlight for character keys
      if (!["⇧", "⌫", "⏎", "#+=", "ABC", "SPACE", ""].includes(key)) {
        showKeyHighlight(keyId);
      }

      // Add timing jitter (0-50ms)
      const jitter = getSecureRandom() * 50;

      setTimeout(() => {
        if (key === "⇧") {
          setMode((prev) => (prev === "uppercase" ? "lowercase" : "uppercase"));
        } else if (key === "#+=") {
          setMode("symbols");
        } else if (key === "ABC") {
          setMode("lowercase");
        } else if (key === "⌫") {
          onDelete();
        } else if (key === "⏎") {
          onSubmit();
        } else if (key === "SPACE") {
          onKeyPress(" ");
        } else if (key !== "") {
          onKeyPress(key);
          if (mode === "uppercase") {
            setMode("lowercase");
          }
        }
      }, jitter);
    },
    [mode, onKeyPress, onDelete, onSubmit, getSecureRandom, showKeyHighlight]
  );

  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle mount/unmount animations
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready for animation
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else if (shouldRender) {
      setIsAnimating(false);
      // Wait for exit animation to complete
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, shouldRender]);

  if (!shouldRender) return null;

  const rows = getRows();

  const handleDismiss = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSubmit();
  };

  return (
    <div 
      className={`
        fixed bottom-0 left-0 right-0 
        bg-secondary/95 backdrop-blur-sm border-t border-border 
        z-50 select-none touch-none
        transition-transform duration-300 ease-out
        ${isAnimating ? "translate-y-0" : "translate-y-full"}
      `}
    >
      {/* Dismiss row */}
      <button
        type="button"
        onTouchStart={handleDismiss}
        onMouseDown={handleDismiss}
        className="w-full h-8 flex items-center justify-center border-b border-border/50 bg-muted/50 hover:bg-muted transition-colors"
        style={{
          WebkitTapHighlightColor: "transparent",
          WebkitTouchCallout: "none",
          userSelect: "none",
        }}
      >
        <ChevronDown className="w-5 h-5 text-muted-foreground" />
      </button>
      
      {/* Keyboard rows */}
      <div className="max-w-lg mx-auto p-2">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex justify-center gap-1 mb-1"
          >
            {row.map((key, colIndex) => {
              if (key === "") return null;
              
              const keyId = `${rowIndex}-${colIndex}`;
              const isHighlighted = highlightedKey === keyId;
              const isSpecial = ["⇧", "⌫", "⏎", "#+=", "ABC"].includes(key);
              const isSpace = key === "SPACE";
              
              return (
                <button
                  key={colIndex}
                  type="button"
                  onTouchStart={(e) => handleKeyTouch(key, rowIndex, colIndex, e)}
                  onMouseDown={(e) => handleKeyTouch(key, rowIndex, colIndex, e)}
                  className={`
                    ${isSpace ? "flex-1 min-w-[140px]" : isSpecial ? "w-12" : "w-8"} 
                    h-11 
                    rounded-md 
                    flex items-center justify-center
                    text-sm font-medium
                    transition-none
                    ${isHighlighted ? "bg-primary/30 shadow-[0_0_8px_hsl(var(--primary)/0.4)]" : "bg-muted"}
                    ${isSpecial ? "text-primary" : "text-foreground"}
                  `}
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    WebkitTouchCallout: "none",
                    userSelect: "none",
                  }}
                >
                  {isSpace ? "" : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
