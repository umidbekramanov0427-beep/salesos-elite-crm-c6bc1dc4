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
  group?: "analytics";
};

// Sidebar is intentionally a short, fixed list — everything else (Leads,
// Contacts, Companies, Deals, Inbox, Analytics, CRM Stages, Integrations)
// is reached from within these pages rather than getting its own nav slot.
export const NAV_ITEMS: NavItem[] = [
  { label: "Leaderboard", to: "/", icon: Trophy },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "AI Assistant", to: "/ai-assistant", icon: Sparkles },
  { label: "Funnels", to: "/funnels", icon: Workflow, group: "analytics" },
  { label: "Pipeline", to: "/crm/pipeline", icon: KanbanSquare, group: "analytics" },
  { label: "Important Tasks", to: "/tasks", icon: ClipboardList, badge: "8", group: "analytics" },
  { label: "Audio Analytics", to: "/audio-analytics", icon: AudioLines, group: "analytics" },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Admin Panel", to: "/admin", icon: ShieldCheck, adminOnly: true },
];
