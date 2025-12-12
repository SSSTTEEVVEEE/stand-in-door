import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Samaritan script range: U+0800 to U+083F (64 characters)
const WATERMARK_START = 0x0800;
const WATERMARK_END = 0x083f;

// Strip all watermark characters from a string for display purposes
export function stripWatermarkChars(str: string): string {
  if (!str) return str;
  return str.split('').filter(char => {
    const code = char.charCodeAt(0);
    return code < WATERMARK_START || code > WATERMARK_END;
  }).join('');
}

// Generate a random Samaritan character using crypto
export function getWatermarkChar(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const charCode = WATERMARK_START + (array[0] % (WATERMARK_END - WATERMARK_START + 1));
  return String.fromCharCode(charCode);
}

// Get a secure random number between min and max (inclusive)
export function getSecureRandomInt(min: number, max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return min + (array[0] % (max - min + 1));
}
