import {
  Trophy,
  LayoutDashboard,
  Workflow,
  ClipboardList,
  AudioLines,
  Settings,
  ShieldCheck,
  KanbanSquare,
  Sparkles,
  Clock,
  Building2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  // Only the platform operator (role: platform_owner) sees this item —
  // they belong to no single company, so every other nav item (which
  // shows a company's own CRM data) is hidden from them instead.
  platformOwnerOnly?: boolean;
  badge?: string;
  group?: "analytics";
  // Tailwind text-color utility applied to the icon when the item is not
  // the active route, so each item reads as its own thing at a glance
  // instead of a wall of identical muted icons.
  iconColor?: string;
};

// Sidebar is intentionally a short, fixed list — everything else (Leads,
// Contacts, Companies, Deals, Inbox, Analytics, CRM Stages, Integrations)
// is reached from within these pages rather than getting its own nav slot.
export const NAV_ITEMS: NavItem[] = [
  { label: "Leaderboard", to: "/", icon: Trophy, iconColor: "text-amber-500" },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, iconColor: "text-blue-500" },
  { label: "AI Assistant", to: "/ai-assistant", icon: Sparkles, iconColor: "text-violet-500" },
  {
    label: "Funnels",
    to: "/funnels",
    icon: Workflow,
    group: "analytics",
    iconColor: "text-indigo-500",
  },
  {
    label: "AmoCRM",
    to: "/crm/pipeline",
    icon: KanbanSquare,
    group: "analytics",
    iconColor: "text-cyan-500",
  },
  {
    label: "Important Tasks",
    to: "/tasks",
    icon: ClipboardList,
    badge: "8",
    group: "analytics",
    iconColor: "text-orange-500",
  },
  {
    label: "Audio Analytics",
    to: "/audio-analytics",
    icon: AudioLines,
    group: "analytics",
    iconColor: "text-pink-500",
  },
  {
    label: "Attendance & Quotas",
    to: "/attendance",
    icon: Clock,
    group: "analytics",
    iconColor: "text-teal-500",
  },
  { label: "Settings", to: "/settings", icon: Settings },
  {
    label: "Admin Panel",
    to: "/admin",
    icon: ShieldCheck,
    adminOnly: true,
    iconColor: "text-red-500",
  },
  {
    label: "Platform",
    to: "/platform",
    icon: Building2,
    platformOwnerOnly: true,
    iconColor: "text-fuchsia-500",
  },
];
