import { cn } from "@/lib/utils";

interface RepeatDaysSelectorProps {
  selectedDays: string[];
  onChange: (days: string[]) => void;
  disabled?: boolean;
}

const DAYS = [
  { key: "M", label: "M" },
  { key: "Tu", label: "Tu" },
  { key: "W", label: "W" },
  { key: "Th", label: "Th" },
  { key: "F", label: "F" },
  { key: "Sa", label: "Sa" },
  { key: "Su", label: "Su" },
];

export const RepeatDaysSelector = ({ selectedDays, onChange, disabled }: RepeatDaysSelectorProps) => {
  const toggleDay = (day: string) => {
    if (disabled) return;
    
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter(d => d !== day));
    } else {
      onChange([...selectedDays, day]);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {DAYS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => toggleDay(key)}
          className={cn(
            "w-8 h-8 text-xs font-bold rounded transition-all",
            "border border-border",
            selectedDays.includes(key)
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground hover:bg-muted",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

// Helper to get next occurrence of a repeat day
export const getNextRepeatDate = (repeatDays: string[], currentDate: Date): Date | null => {
  if (repeatDays.length === 0) return null;
  
  const dayMap: Record<string, number> = {
    "Su": 0, "M": 1, "Tu": 2, "W": 3, "Th": 4, "F": 5, "Sa": 6
  };
  
  const repeatDayNumbers = repeatDays.map(d => dayMap[d]).filter(n => n !== undefined);
  if (repeatDayNumbers.length === 0) return null;
  
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + 1); // Start from tomorrow
  
  // Find next matching day within 7 days
  for (let i = 0; i < 7; i++) {
    if (repeatDayNumbers.includes(nextDate.getDay())) {
      return nextDate;
    }
    nextDate.setDate(nextDate.getDate() + 1);
  }
  
  return null;
};

// Helper to check if a date matches repeat days
export const dateMatchesRepeatDays = (date: Date, repeatDays: string[]): boolean => {
  if (repeatDays.length === 0) return false;
  
  const dayMap: Record<string, number> = {
    "Su": 0, "M": 1, "Tu": 2, "W": 3, "Th": 4, "F": 5, "Sa": 6
  };
  
  const dayOfWeek = date.getDay();
  return repeatDays.some(d => dayMap[d] === dayOfWeek);
};
