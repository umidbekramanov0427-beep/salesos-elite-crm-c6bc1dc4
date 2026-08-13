import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Color-codes a role badge consistently everywhere a role Pill is shown. */
export function roleTone(role: string): "gold" | "blue" | "success" | "danger" | "neutral" {
  switch (role) {
    case "super_admin":
      return "gold";
    case "rop":
      return "blue";
    case "sotuv_menejeri":
      return "success";
    case "platform_owner":
      return "danger";
    default:
      return "neutral";
  }
}

/** "2h ago", "Yesterday", "3 days ago" — used across CRM list/detail views. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

/** "8 Aug 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** "Today, 15:00" / "Tomorrow, 11:30" / "8 Aug, 10:00" */
export function formatFollowUp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(d);
  const dayDiff = Math.round((d.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / 86400000);
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  return `${formatDate(iso)}, ${time}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "—";
}
