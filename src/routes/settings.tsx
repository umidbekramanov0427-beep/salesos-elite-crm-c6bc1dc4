import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard } from "@/components/layout/Primitives";
import { useCurrency, CURRENCIES } from "@/lib/currency";
import { useI18n, LANGS, LANG_LABELS } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useUpdateProfile } from "@/hooks/use-crm-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SalesOS Elite" },
      { name: "description", content: "Profile, workspace, language and appearance settings." },
      { property: "og:title", content: "Settings — SalesOS Elite" },
      { property: "og:description", content: "Workspace, appearance and preference settings." },
    ],
  }),
  component: SettingsPage,
});

function SegmentedControl<T extends string>({
  value,
  options,
  render,
  onChange,
}: {
  value: T;
  options: readonly T[];
  render?: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex h-11 items-center gap-1 rounded-xl border border-border bg-surface p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "h-full rounded-lg px-3 text-sm font-semibold transition-colors",
            value === o
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

function SettingsPage() {
  const { unit, setUnit } = useCurrency();
  const { lang, setLang } = useI18n();
  const { dark, setDark } = useTheme();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        id: user.id,
        patch: { full_name: fullName.trim(), phone: phone.trim() || null },
      });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Personal and workspace configuration for SalesOS Elite."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Profile">
          <form onSubmit={onSaveProfile} className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-medium text-muted-foreground">Full name</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-muted-foreground">Email</span>
              <input
                value={user?.email ?? ""}
                disabled
                className="mt-2 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-muted-foreground">Role</span>
              <input
                value={user?.role ?? ""}
                disabled
                className="mt-2 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm capitalize text-muted-foreground outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-muted-foreground">Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Preferences">
          <div className="space-y-6">
            <div>
              <span className="text-[13px] font-medium text-muted-foreground">Currency</span>
              <div className="mt-2">
                <SegmentedControl value={unit} options={CURRENCIES} onChange={setUnit} />
              </div>
            </div>
            <div>
              <span className="text-[13px] font-medium text-muted-foreground">Language</span>
              <div className="mt-2">
                <SegmentedControl
                  value={lang}
                  options={LANGS}
                  render={(l) => LANG_LABELS[l]}
                  onChange={setLang}
                />
              </div>
            </div>
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">Appearance</p>
                <p className="mt-1 text-xs text-subtle">Switch the workspace to the dark palette</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={dark}
                onClick={() => setDark(!dark)}
                className={cn(
                  "mt-1 inline-flex h-9 w-16 shrink-0 items-center justify-center gap-1 rounded-full transition-colors",
                  dark ? "bg-foreground" : "bg-border",
                )}
              >
                <Sun className={cn("h-3.5 w-3.5", dark ? "text-background/40" : "text-warning")} />
                <Moon
                  className={cn("h-3.5 w-3.5", dark ? "text-background" : "text-background/40")}
                />
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
