import {
  Trophy,
  LayoutDashboard,
  Workflow,
  BarChart3,
  ClipboardList,
  Pin,
  Inbox,
  Layers,
  AudioLines,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  badge?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Leaderboard", to: "/", icon: Trophy },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Funnels", to: "/funnels", icon: Workflow },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Important Tasks", to: "/tasks", icon: ClipboardList, badge: "8" },
  { label: "Lead Tasks", to: "/lead-tasks", icon: Pin },
  { label: "Inbox", to: "/inbox", icon: Inbox, badge: "3" },
  { label: "CRM Stages", to: "/crm-stages", icon: Layers },
  { label: "Audio Analytics", to: "/audio-analytics", icon: AudioLines },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Admin Panel", to: "/admin", icon: ShieldCheck, adminOnly: true },
];
