import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Menu, Search, X } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = true;

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-surface">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} isAdmin={isAdmin} />

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[264px] border-r border-sidebar-border bg-sidebar p-3">
            <div className="flex items-center justify-between px-2 pb-4 pt-2">
              <p className="text-sm font-semibold">SalesOS Elite</p>
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                      active ? "bg-sidebar-active text-foreground" : "text-sidebar-foreground hover:bg-accent",
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-8">
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              placeholder="Search leads, tasks, people…"
              className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle focus:border-primary/40 focus:bg-background"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/inbox"
              className="relative rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            </Link>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background py-1.5 pl-1.5 pr-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint text-xs font-semibold text-mint-foreground">
                AS
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-[13px] font-medium">Aizhan S.</p>
                <p className="text-[11px] text-subtle">Admin</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 md:px-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
