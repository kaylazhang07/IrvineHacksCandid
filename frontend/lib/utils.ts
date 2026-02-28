import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CATEGORY_COLORS, CategoryType } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDollar(n: number): string {
  const abs = Math.abs(Math.round(n));
  const sign = n >= 0 ? '+' : '-';
  return `${sign}$${abs.toLocaleString()}/yr`;
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category as CategoryType] ?? CATEGORY_COLORS.other;
}
