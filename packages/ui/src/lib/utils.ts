import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names, dropping falsy ones and letting later Tailwind classes win over conflicting earlier ones.
 *
 * @param inputs - Class strings, arrays or `{ class: condition }` objects.
 * @returns One merged class string.
 * @example
 * cn("px-2 text-sm", isActive && "font-medium", "px-4"); // "text-sm font-medium px-4"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
