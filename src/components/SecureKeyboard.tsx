import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, Globe, Mic } from "lucide-react";
import { usePlatform } from "@/hooks/usePlatform";
import { getWatermarkChar, getSecureRandomInt } from "@/lib/utils";

type KeyboardMode = "lowercase" | "uppercase" | "symbols";
type InputType = "email" | "password" | "text";

interface SecureKeyboardProps {
  onKeyPress: (char: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  visible: boolean;
  inputType: InputType;
  zeroFeedback?: boolean;
  injectWatermark?: boolean;
}

// iOS-style keyboard layouts
const IOS_LOWERCASE_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["⇧", "z", "x", "c", "v", "b", "n", "m", "⌫"],
  ["123", "🌐", "SPACE", "⏎"],
];

const IOS_UPPERCASE_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["⇧", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
  ["123", "🌐", "SPACE", "⏎"],
];

const IOS_SYMBOL_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", '"'],
  ["#+=", ".", ",", "?", "!", "'", "⌫"],
  ["ABC", "🌐", "SPACE", "⏎"],
];

// Android/Gboard-style keyboard layouts
const ANDROID_LOWERCASE_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["⇧", "z", "x", "c", "v", "b", "n", "m", "⌫"],
  ["?123", ",", "SPACE", ".", "⏎"],
];

const ANDROID_UPPERCASE_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["⇧", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
  ["?123", ",", "SPACE", ".", "⏎"],
];

const ANDROID_SYMBOL_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["@", "#", "$", "%", "&", "-", "+", "(", ")"],
  ["=\\<", "*", '"', "'", ":", ";", "!", "?", "⌫"],
  ["ABC", ",", "SPACE", ".", "⏎"],
];

// Get all key positions for fake touch events
const getAllKeyPositions = (rows: string[][]) => {
  const positions: { row: number; col: number; key: string }[] = [];
  rows.forEach((row, rowIndex) => {
    row.forEach((key, colIndex) => {
      if (key && key !== "SPACE" && !["⇧", "⌫", "⏎", "#+=", "ABC", "123", "?123", "=\\<", "🌐", ",", "."].includes(key)) {
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
  injectWatermark = false,
}: SecureKeyboardProps) => {
  const platform = usePlatform();
  const [mode, setMode] = useState<KeyboardMode>("lowercase");
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTouchRef = useRef(false);
  
  // Watermark injection tracking
  const keystrokeCountRef = useRef(0);
  const nextWatermarkAtRef = useRef(getSecureRandomInt(2, 7));

  const isIOS = platform === 'ios';
  const isAndroid = platform === 'android';

  const getRows = useCallback(() => {
    if (isIOS) {
      switch (mode) {
        case "uppercase": return IOS_UPPERCASE_ROWS;
        case "symbols": return IOS_SYMBOL_ROWS;
        default: return IOS_LOWERCASE_ROWS;
      }
    }
    // Android or default
    switch (mode) {
      case "uppercase": return ANDROID_UPPERCASE_ROWS;
      case "symbols": return ANDROID_SYMBOL_ROWS;
      default: return ANDROID_LOWERCASE_ROWS;
    }
  }, [mode, isIOS]);

  // Generate cryptographically random number
  const getSecureRandom = useCallback(() => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  }, []);

  // Show key highlight (real for email, random for password, none for zero feedback)
  const showKeyHighlight = useCallback((actualKeyId: string) => {
    if (zeroFeedback) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (inputType === "email") {
      setHighlightedKey(actualKeyId);
      timeoutRef.current = setTimeout(() => {
        setHighlightedKey(null);
      }, 100 + getSecureRandom() * 50);
    } else {
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
  }, [inputType, getSecureRandom, getRows, zeroFeedback]);

  // Handle key press with timing jitter and watermark injection
  const handleKeyPress = useCallback(
    (key: string, rowIndex: number, colIndex: number) => {
      const keyId = `${rowIndex}-${colIndex}`;
      
      // Determine if this is a character key (not special)
      const specialKeys = ["⇧", "⌫", "⏎", "#+=", "ABC", "123", "?123", "=\\<", "🌐", "SPACE", ""];
      const isCharacterKey = !specialKeys.includes(key);
      
      if (isCharacterKey) {
        showKeyHighlight(keyId);
      }

      const jitter = getSecureRandom() * 50;

      setTimeout(() => {
        if (key === "⇧") {
          setMode((prev) => (prev === "uppercase" ? "lowercase" : "uppercase"));
        } else if (key === "#+=") {
          setMode("symbols");
        } else if (key === "=\\<") {
          setMode("symbols");
        } else if (key === "ABC") {
          setMode("lowercase");
        } else if (key === "123" || key === "?123") {
          setMode("symbols");
        } else if (key === "⌫") {
          onDelete();
        } else if (key === "⏎") {
          onSubmit();
        } else if (key === "🌐") {
          // Globe key - no action, just a visual element
        } else if (key === "SPACE") {
          onKeyPress(" ");
          // Count space as a keystroke for watermark
          if (injectWatermark) {
            keystrokeCountRef.current++;
            if (keystrokeCountRef.current >= nextWatermarkAtRef.current) {
              onKeyPress(getWatermarkChar());
              keystrokeCountRef.current = 0;
              nextWatermarkAtRef.current = getSecureRandomInt(2, 7);
            }
          }
        } else if (isCharacterKey) {
          onKeyPress(key);
          
          // Watermark injection logic
          if (injectWatermark) {
            keystrokeCountRef.current++;
            if (keystrokeCountRef.current >= nextWatermarkAtRef.current) {
              onKeyPress(getWatermarkChar());
              keystrokeCountRef.current = 0;
              nextWatermarkAtRef.current = getSecureRandomInt(2, 7);
            }
          }
          
          if (mode === "uppercase") {
            setMode("lowercase");
          }
        } else if (key === "," || key === ".") {
          onKeyPress(key);
        }
      }, jitter);
    },
    [mode, onKeyPress, onDelete, onSubmit, getSecureRandom, showKeyHighlight, injectWatermark]
  );

  const handleTouchStart = useCallback(
    (key: string, rowIndex: number, colIndex: number, e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isTouchRef.current = true;
      handleKeyPress(key, rowIndex, colIndex);
    },
    [handleKeyPress]
  );

  const handleMouseDown = useCallback(
    (key: string, rowIndex: number, colIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isTouchRef.current) return;
      handleKeyPress(key, rowIndex, colIndex);
    },
    [handleKeyPress]
  );

  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else if (shouldRender) {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, shouldRender]);

  if (!shouldRender) return null;

  const rows = getRows();

  const handleDismissTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isTouchRef.current = true;
    onSubmit();
  };

  const handleDismissMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTouchRef.current) return;
    onSubmit();
  };

  // Platform-specific styling
  const getKeyboardContainerStyle = () => {
    if (isIOS) {
      return "bg-[hsl(220,10%,85%)] dark:bg-[hsl(0,0%,18%)]";
    }
    return "bg-[hsl(0,0%,20%)] dark:bg-[hsl(0,0%,12%)]";
  };

  const getKeyStyle = (isSpecial: boolean, isSpace: boolean, isHighlighted: boolean) => {
    if (isIOS) {
      const base = isSpecial || isSpace
        ? "bg-[hsl(220,8%,72%)] dark:bg-[hsl(0,0%,28%)] text-foreground"
        : "bg-[hsl(0,0%,100%)] dark:bg-[hsl(0,0%,38%)] text-foreground shadow-[0_1px_0_hsl(0,0%,60%)] dark:shadow-[0_1px_0_hsl(0,0%,8%)]";
      return isHighlighted ? `${base} !bg-[hsl(220,8%,72%)] dark:!bg-[hsl(0,0%,48%)]` : base;
    }
    // Android/Gboard style
    const base = isSpecial
      ? "bg-[hsl(0,0%,28%)] dark:bg-[hsl(0,0%,22%)] text-[hsl(0,0%,80%)]"
      : "bg-[hsl(0,0%,32%)] dark:bg-[hsl(0,0%,25%)] text-[hsl(0,0%,95%)]";
    return isHighlighted ? `${base} !bg-[hsl(0,0%,45%)]` : base;
  };

  const getKeyWidth = (key: string, isSpecial: boolean, isSpace: boolean) => {
    if (isSpace) return "flex-1 min-w-[120px]";
    if (key === "🌐") return "w-10";
    if (key === "⏎") return isIOS ? "w-20" : "w-12";
    if (key === "⇧" || key === "⌫") return "w-12";
    if (key === "123" || key === "ABC" || key === "?123" || key === "#+=") return "w-12";
    if (key === "," || key === ".") return "w-10";
    return "w-8";
  };

  const renderKey = (key: string) => {
    if (key === "🌐") return <Globe className="w-4 h-4" />;
    if (key === "SPACE") return isIOS ? <span className="text-xs text-muted-foreground">space</span> : null;
    return key;
  };

  return (
    <div 
      className={`
        fixed bottom-0 left-0 right-0 
        ${getKeyboardContainerStyle()}
        backdrop-blur-sm border-t border-border/30
        z-50 select-none touch-none
        transition-transform duration-300 ease-out
        ${isAnimating ? "translate-y-0" : "translate-y-full"}
      `}
    >
      {/* Dismiss row */}
      <button
        type="button"
        onTouchStart={handleDismissTouchStart}
        onMouseDown={handleDismissMouseDown}
        className={`w-full h-7 flex items-center justify-center border-b border-border/20 ${
          isIOS ? "bg-[hsl(220,10%,82%)] dark:bg-[hsl(0,0%,15%)]" : "bg-[hsl(0,0%,18%)] dark:bg-[hsl(0,0%,10%)]"
        } hover:opacity-80 transition-opacity`}
        style={{
          WebkitTapHighlightColor: "transparent",
          WebkitTouchCallout: "none",
          userSelect: "none",
        }}
      >
        <ChevronDown className={`w-4 h-4 ${isIOS ? "text-[hsl(0,0%,40%)]" : "text-[hsl(0,0%,60%)]"}`} />
      </button>
      
      {/* Keyboard rows */}
      <div className={`max-w-lg mx-auto ${isIOS ? "p-1.5 pb-5" : "p-1 pb-2"}`}>
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`flex justify-center ${isIOS ? "gap-1.5 mb-2" : "gap-1 mb-1"}`}
          >
            {row.map((key, colIndex) => {
              if (key === "") return null;
              
              const keyId = `${rowIndex}-${colIndex}`;
              const isHighlighted = highlightedKey === keyId;
              const specialKeys = ["⇧", "⌫", "⏎", "#+=", "ABC", "123", "?123", "=\\<", "🌐"];
              const isSpecial = specialKeys.includes(key);
              const isSpace = key === "SPACE";
              
              return (
                <button
                  key={colIndex}
                  type="button"
                  onTouchStart={(e) => handleTouchStart(key, rowIndex, colIndex, e)}
                  onMouseDown={(e) => handleMouseDown(key, rowIndex, colIndex, e)}
                  className={`
                    ${getKeyWidth(key, isSpecial, isSpace)}
                    ${isIOS ? "h-11 rounded-lg" : "h-12 rounded-md"}
                    flex items-center justify-center
                    ${isIOS ? "text-[17px]" : "text-base"}
                    font-normal
                    transition-none
                    ${getKeyStyle(isSpecial, isSpace, isHighlighted)}
                    active:opacity-70
                  `}
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    WebkitTouchCallout: "none",
                    userSelect: "none",
                    fontFamily: isIOS ? '-apple-system, BlinkMacSystemFont, sans-serif' : 'Roboto, sans-serif',
                  }}
                >
                  {renderKey(key)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
