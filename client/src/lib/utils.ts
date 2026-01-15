import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeRemaining(endTime: Date | string): string {
  const end = new Date(endTime);
  const now = new Date();
  
  if (end <= now) {
    return "CLOSED";
  }
  
  const seconds = differenceInSeconds(end, now);
  const minutes = differenceInMinutes(end, now);
  const hours = differenceInHours(end, now);
  const days = differenceInDays(end, now);
  
  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${seconds}s`;
}

export function isAuctionEnding(endTime: Date | string): boolean {
  const end = new Date(endTime);
  const now = new Date();
  const hours = differenceInHours(end, now);
  return hours < 1 && end > now;
}

export function isAuctionClosed(endTime: Date | string): boolean {
  const end = new Date(endTime);
  const now = new Date();
  return end <= now;
}

export function hasAuctionStarted(startTime: Date | string | null | undefined): boolean {
  if (!startTime) return true; // No start time means immediately available
  const start = new Date(startTime);
  const now = new Date();
  return start <= now;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function calculateTotalValue(amount: number, years: number, yearFactors: number[]): number {
  const factor = yearFactors[years - 1] || 1;
  return amount * factor;
}

export function calculateMinimumBid(currentTotalValue: number, years: number, yearFactors: number[], bidIncrement: number = 0.10): number {
  const factor = yearFactors[years - 1] || 1;
  const minTotalValue = currentTotalValue * (1 + bidIncrement);
  return Math.ceil(minTotalValue / factor);
}

export function formatNumberWithCommas(value: number | string): string {
  const num = typeof value === 'string' ? parseFormattedNumber(value) : value;
  if (num === 0 || isNaN(num)) return '';
  return new Intl.NumberFormat('en-US').format(num);
}

export function parseFormattedNumber(value: string): number {
  const cleaned = value.replace(/,/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}
