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
  Plug,

  ShieldCheck,
  UserSearch,
  Users,
  Building2,
  Handshake,
  KanbanSquare,
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
  { label: "Integrations", to: "/integrations", icon: Plug },
  { label: "Settings", to: "/settings", icon: Settings },

  { label: "Admin Panel", to: "/admin", icon: ShieldCheck, adminOnly: true },
];

export const CRM_NAV_ITEMS: NavItem[] = [
  { label: "Leads", to: "/crm/leads", icon: UserSearch },
  { label: "Contacts", to: "/crm/contacts", icon: Users },
  { label: "Companies", to: "/crm/companies", icon: Building2 },
  { label: "Deals", to: "/crm/deals", icon: Handshake },
  { label: "Pipeline", to: "/crm/pipeline", icon: KanbanSquare },
];
