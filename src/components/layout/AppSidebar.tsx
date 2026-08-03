import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronsLeft, Command, Sparkles } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  isAdmin: boolean;
};

export function AppSidebar({ collapsed, onToggle, isAdmin }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);

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
            <p className="truncate text-sm font-semibold text-foreground">SalesOS Elite</p>
            <p className="truncate text-xs text-sidebar-muted">Sales Operating System</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                active
                  ? "bg-sidebar-active text-sidebar-active-foreground"
                  : "text-sidebar-foreground hover:bg-accent",
                collapsed && "justify-center px-0",
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  active ? "text-mint-foreground" : "text-sidebar-muted group-hover:text-foreground",
                )}
              />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}

        <div className="pt-4">
          {!collapsed && (
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">CRM Core</p>
          )}
          <div className="space-y-1">
            {CRM_NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                    active
                      ? "bg-sidebar-active text-sidebar-active-foreground"
                      : "text-sidebar-foreground hover:bg-accent",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-colors",
                      active ? "text-mint-foreground" : "text-sidebar-muted group-hover:text-foreground",
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="mb-3 rounded-xl bg-mint p-3">
            <p className="text-xs font-semibold text-foreground">Monthly target</p>
            <p className="mt-1 text-xs text-muted-foreground">82% reached · 5% bonus unlocked at 100%</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-mint-border">
              <div className="h-full rounded-full bg-success" style={{ width: "82%" }} />
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-accent hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
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
