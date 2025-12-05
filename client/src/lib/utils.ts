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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function calculateTotalValue(amount: number, years: number, yearFactors: number[]): number {
  const factor = yearFactors[years - 1] || 1;
  return amount * factor;
}

export function calculateMinimumBid(currentTotalValue: number, years: number, yearFactors: number[]): number {
  const factor = yearFactors[years - 1] || 1;
  const minTotalValue = currentTotalValue * 1.1;
  return Math.ceil(minTotalValue / factor);
}
