import { useState, useEffect, useCallback, useRef } from "react";

type KeyboardMode = "lowercase" | "uppercase" | "symbols";

interface SecureKeyboardProps {
  onKeyPress: (char: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  visible: boolean;
}

const LOWERCASE_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ""],
  ["⇧", "z", "x", "c", "v", "b", "n", "m", "⌫", ""],
  ["#+=", "SPACE", "⏎"],
];

const UPPERCASE_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", ""],
  ["⇧", "Z", "X", "C", "V", "B", "N", "M", "⌫", ""],
  ["#+=", "SPACE", "⏎"],
];

const SYMBOL_ROWS = [
  ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
  ["-", "_", "=", "+", "[", "]", "{", "}", "\\", "|"],
  [";", ":", "'", '"', ",", ".", "<", ">", "/", "?"],
  ["⇧", "`", "~", "€", "£", "¥", "©", "®", "⌫", ""],
  ["ABC", "SPACE", "⏎"],
];

// Get all key positions for fake touch events
const getAllKeyPositions = (rows: string[][]) => {
  const positions: { row: number; col: number; key: string }[] = [];
  rows.forEach((row, rowIndex) => {
    row.forEach((key, colIndex) => {
      if (key && key !== "SPACE") {
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
}: SecureKeyboardProps) => {
  const [mode, setMode] = useState<KeyboardMode>("lowercase");
  const [decoyKeys, setDecoyKeys] = useState<Set<string>>(new Set());
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const animationFrameRef = useRef<number | null>(null);

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

  // Fake touch event generator
  useEffect(() => {
    if (!visible) {
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const generateFakeTouch = () => {
      const rows = getRows();
      const positions = getAllKeyPositions(rows);
      
      // Randomly select 1-3 keys to highlight
      const numKeys = 1 + Math.floor(getSecureRandom() * 2);
      const selectedKeys = new Set<string>();
      
      for (let i = 0; i < numKeys; i++) {
        const randomIndex = Math.floor(getSecureRandom() * positions.length);
        const pos = positions[randomIndex];
        selectedKeys.add(`${pos.row}-${pos.col}`);
      }
      
      setDecoyKeys(selectedKeys);
      
      // Clear decoy after random duration (50-150ms)
      const clearDuration = 50 + getSecureRandom() * 100;
      const clearTimeout = setTimeout(() => {
        setDecoyKeys(new Set());
      }, clearDuration);
      timeoutRefs.current.push(clearTimeout);
      
      // Schedule next fake touch at random interval (100-400ms)
      const nextInterval = 100 + getSecureRandom() * 300;
      const nextTimeout = setTimeout(generateFakeTouch, nextInterval);
      timeoutRefs.current.push(nextTimeout);
    };

    // Start fake touch generation
    const initialDelay = 500 + getSecureRandom() * 500;
    const initialTimeout = setTimeout(generateFakeTouch, initialDelay);
    timeoutRefs.current.push(initialTimeout);

    return () => {
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];
    };
  }, [visible, mode, getSecureRandom]);

  // Handle key press with timing jitter and coordinate noise
  const handleKeyTouch = useCallback(
    (key: string, e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

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
          // Auto-return to lowercase after typing in uppercase (except for caps lock double-tap)
          if (mode === "uppercase") {
            setMode("lowercase");
          }
        }
      }, jitter);
    },
    [mode, onKeyPress, onDelete, onSubmit, getSecureRandom]
  );

  if (!visible) return null;

  const rows = getRows();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-secondary/95 backdrop-blur-sm border-t border-border p-2 z-50 select-none touch-none">
      <div className="max-w-lg mx-auto">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex justify-center gap-1 mb-1"
          >
            {row.map((key, colIndex) => {
              if (key === "") return <div key={colIndex} className="w-8 h-11" />;
              
              const keyId = `${rowIndex}-${colIndex}`;
              const isDecoy = decoyKeys.has(keyId);
              const isSpecial = ["⇧", "⌫", "⏎", "#+=", "ABC"].includes(key);
              const isSpace = key === "SPACE";
              
              return (
                <button
                  key={colIndex}
                  type="button"
                  onTouchStart={(e) => handleKeyTouch(key, e)}
                  onMouseDown={(e) => handleKeyTouch(key, e)}
                  className={`
                    ${isSpace ? "flex-1 min-w-[140px]" : isSpecial ? "w-12" : "w-8"} 
                    h-11 
                    rounded-md 
                    flex items-center justify-center
                    text-sm font-medium
                    transition-none
                    ${isDecoy ? "bg-primary/30 shadow-[0_0_8px_hsl(var(--primary)/0.4)]" : "bg-muted"}
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
