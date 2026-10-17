import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Ghép các class Tailwind lại với nhau.
 * clsx xử lý điều kiện, tailwind-merge xử lý xung đột class (class sau thắng).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
