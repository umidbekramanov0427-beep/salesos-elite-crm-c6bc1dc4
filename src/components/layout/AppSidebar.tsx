import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronsUpDown,
  ChevronsLeft,
  CircleCheck,
  Command,
  LogOut,
  Plug,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { LANGS, LANG_FLAGS, LANG_SHORT, useI18n, type Lang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useIntegrationSetting } from "@/hooks/use-crm-data";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  isAdmin: boolean;
};

function IntegrationsStatus({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n();
  const { data: amocrm } = useIntegrationSetting("amocrm");
  const items = [{ name: "amoCRM", connected: amocrm?.enabled ?? false }];
  const anyConnected = items.some((i) => i.connected);

  const trigger = collapsed ? (
    <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-mint">
      <Plug className={cn("h-4 w-4", anyConnected ? "text-success" : "text-mint-foreground")} />
    </div>
  ) : (
    <div className="mx-3 mb-2 flex cursor-default items-center gap-2 rounded-xl border border-mint-border bg-mint px-3 py-2 text-xs">
      <Plug
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          anyConnected ? "text-success" : "text-mint-foreground",
        )}
      />
      <span className="truncate font-medium text-mint-foreground">
        {t("nav.integrations")}
        {anyConnected
          ? `: ${items
              .filter((i) => i.connected)
              .map((i) => i.name)
              .join(", ")}`
          : ""}
      </span>
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px]">
          <p className="font-semibold">{t("nav.integrations")}</p>
          <ul className="mt-1 space-y-0.5">
            {items.map((i) => (
              <li key={i.name}>
                {i.name}: {i.connected ? t("common.connected") : t("common.notConnected")}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BusinessProfileLink({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n();

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/settings"
              search={{ section: "business" }}
              className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-warning/20 text-warning"
            >
              <CircleCheck className="h-5 w-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{t("settings.nav.business")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Link
      to="/settings"
      search={{ section: "business" }}
      className="mx-3 mb-2 flex items-center gap-2.5 rounded-xl border border-warning/40 bg-warning/15 px-3 py-3 text-sm font-semibold text-warning-foreground shadow-soft transition-colors hover:bg-warning/25"
    >
      <CircleCheck className="h-5 w-5 shrink-0 text-warning" />
      <span className="flex-1 truncate">{t("settings.nav.business")}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-warning" />
    </Link>
  );
}

function UserMenu({ collapsed, isAdmin }: { collapsed: boolean; isAdmin: boolean }) {
  const { t, lang, setLang } = useI18n();
  const { dark, setDark } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    void navigate({ to: "/login", replace: true });
  }

  const trigger = collapsed ? (
    <button className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-xs font-semibold text-mint-foreground transition-colors hover:bg-mint-border">
      {user?.initials ?? "?"}
    </button>
  ) : (
    <button className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint text-xs font-semibold text-mint-foreground">
        {user?.initials ?? "?"}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {user?.name ?? "…"}
        </span>
        <span className="block truncate text-[11px] text-subtle">{user?.email ?? ""}</span>
      </span>
      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-subtle" />
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-72 space-y-3 p-4">
        <div className="rounded-xl bg-surface p-3">
          <span className="text-[13px] font-semibold text-muted-foreground">
            {t("userMenu.language")}
          </span>
          <div className="mt-2">
            <SegmentedControl<Lang>
              value={lang}
              options={LANGS}
              render={(l) => `${LANG_FLAGS[l]} ${LANG_SHORT[l]}`}
              onChange={setLang}
              size="sm"
            />
          </div>
        </div>
        <div className="rounded-xl bg-surface p-3">
          <span className="text-[13px] font-semibold text-muted-foreground">
            {t("userMenu.theme")}
          </span>
          <div className="mt-2">
            <SegmentedControl<"light" | "dark">
              value={dark ? "dark" : "light"}
              options={["light", "dark"]}
              render={(v) => (v === "light" ? t("userMenu.light") : t("userMenu.dark"))}
              onChange={(v) => setDark(v === "dark")}
              size="sm"
            />
          </div>
        </div>
        {isAdmin && (
          <Link
            to="/admin"
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <ShieldCheck className="h-4 w-4" /> {t("nav./admin")}
          </Link>
        )}
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" /> {t("userMenu.logout")}
        </button>
      </PopoverContent>
    </Popover>
  );
}

export function AppSidebar({ collapsed, onToggle, isAdmin }: Props) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mainItems = NAV_ITEMS.filter(
    (i) => (!i.adminOnly || isAdmin) && i.to !== "/settings" && i.to !== "/admin",
  );
  const topItems = mainItems.filter((i) => !i.group);
  const analyticsItems = mainItems.filter((i) => i.group === "analytics");
  const settingsItem = NAV_ITEMS.find((i) => i.to === "/settings")!;

  function renderItem(item: (typeof NAV_ITEMS)[number]) {
    const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
    const isSettings = item.to === "/settings";
    return (
      <Link
        key={item.to}
        to={item.to}
        title={collapsed ? t(`nav.${item.to}`) : undefined}
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors duration-200",
          active
            ? "bg-sidebar-active text-sidebar-active-foreground"
            : "bg-card text-sidebar-foreground shadow-soft",
          !active && isSettings && "hover:bg-primary/15 hover:text-primary",
          !active && !isSettings && "hover:bg-accent",
          collapsed && "justify-center px-0",
        )}
      >
        <item.icon
          className={cn(
            "h-[18px] w-[18px] shrink-0 transition-colors",
            active
              ? "text-sidebar-active-foreground"
              : "text-sidebar-muted group-hover:text-current",
          )}
        />
        {!collapsed && (
          <>
            <span className="truncate">{t(`nav.${item.to}`)}</span>
            {item.badge && (
              <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );
  }

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out lg:flex",
        collapsed ? "w-[76px]" : "w-[264px]",
      )}
    >
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
          <Sparkles className="h-[18px] w-[18px]" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{t("app.name")}</p>
            <p className="truncate text-xs text-sidebar-muted">{t("app.tagline")}</p>
          </div>
        )}
      </div>

      <div className="px-0 pb-1 pt-1">
        <IntegrationsStatus collapsed={collapsed} />
        <BusinessProfileLink collapsed={collapsed} />
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
        {topItems.map((item) => renderItem(item))}
        {analyticsItems.length > 0 && (
          <>
            {!collapsed && (
              <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">
                {t("nav.groupAnalytics")}
              </p>
            )}
            {collapsed && <div className="my-3 border-t border-sidebar-border" />}
            <div className="space-y-1.5">{analyticsItems.map((item) => renderItem(item))}</div>
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="mb-3 rounded-xl bg-mint p-3">
            <p className="text-xs font-semibold text-foreground">{t("nav.monthlyTarget")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("nav.monthlyTargetHint")}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-mint-border">
              <div className="h-full rounded-full bg-success" style={{ width: "82%" }} />
            </div>
          </div>
        )}

        <div>{renderItem(settingsItem)}</div>

        <div className="mt-2">
          <UserMenu collapsed={collapsed} isAdmin={isAdmin} />
        </div>

        <button
          onClick={onToggle}
          className={cn(
            "mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-accent hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <ChevronsLeft
            className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")}
          />
          {!collapsed && <span>{t("nav.collapse")}</span>}
          {!collapsed && (
            <span className="ml-auto flex items-center gap-0.5 text-[11px] text-subtle">
              <Command className="h-3 w-3" />B
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
