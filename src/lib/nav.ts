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
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  badge?: string;
};

// Sidebar is intentionally a short, fixed list — everything else (Leads,
// Contacts, Companies, Deals, Inbox, Analytics, CRM Stages, Integrations)
// is reached from within these pages rather than getting its own nav slot.
export const NAV_ITEMS: NavItem[] = [
  { label: "Leaderboard", to: "/", icon: Trophy },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Funnels", to: "/funnels", icon: Workflow },
  { label: "Pipeline", to: "/crm/pipeline", icon: KanbanSquare },
  { label: "Important Tasks", to: "/tasks", icon: ClipboardList, badge: "8" },
  { label: "Audio Analytics", to: "/audio-analytics", icon: AudioLines },
  { label: "AI Assistant", to: "/ai-assistant", icon: Sparkles },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Admin Panel", to: "/admin", icon: ShieldCheck, adminOnly: true },
];
