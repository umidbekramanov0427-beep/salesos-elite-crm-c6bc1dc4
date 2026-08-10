import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Globe, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useI18n, LANGS, LANG_SHORT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — SalesOS Elite CRM" },
      {
        name: "description",
        content: "Sign in to SalesOS Elite, the sales operating system for revenue teams.",
      },
      { property: "og:title", content: "Sign in — SalesOS Elite CRM" },
      { property: "og:description", content: "Secure access to your SalesOS Elite workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Supabase error messages arrive in English regardless of app locale, so map
// the ones users actually hit to a localized string; anything unrecognized
// falls through as-is rather than being replaced by a generic "wrong
// password" message that hides the real cause (e.g. an unconfirmed email).
function signInErrorMessage(raw: string, t: (key: string) => string): string {
  if (/email not confirmed/i.test(raw)) return t("login.emailNotConfirmed");
  if (/invalid login credentials/i.test(raw)) return t("login.failed");
  return raw;
}

function LoginPage() {
  const { user, ready, signIn, signUp } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  const [confirmNotice, setConfirmNotice] = useState(false);

  useEffect(() => {
    if (ready && user) void navigate({ to: "/", replace: true });
  }, [ready, user, navigate]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: typeof errors = {};
    if (mode === "signup" && fullName.trim().length < 2) next.fullName = t("login.needFullName");
    if (!EMAIL_RE.test(email.trim())) next.email = t("login.invalidEmail");
    if (password.length < 8) next.password = t("login.shortPassword");
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setConfirmNotice(false);
    const result =
      mode === "signin" ? await signIn(email, password) : await signUp(email, password, fullName);
    setBusy(false);

    if (!result.ok) {
      setErrors({ form: mode === "signin" ? signInErrorMessage(result.error, t) : result.error });
      return;
    }

    if (mode === "signup" && "needsEmailConfirm" in result && result.needsEmailConfirm) {
      toast.success(t("login.signupSuccess"));
      setConfirmNotice(true);
      setMode("signin");
      setPassword("");
      return;
    }

    toast.success(mode === "signin" ? t("login.success") : t("login.signupSuccess"));
    void navigate({ to: "/", replace: true });
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-3 py-4 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[460px] w-[460px] rounded-full bg-mint blur-3xl" />

      <div className="relative grid w-full max-w-[1600px] overflow-hidden rounded-3xl border border-border bg-background/70 shadow-soft backdrop-blur-xl lg:h-[calc(100vh-3rem)] lg:grid-cols-2">
        <section className="relative hidden flex-col justify-between gap-8 overflow-hidden border-r border-border bg-gradient-to-br from-[#0B1120] via-[#0E1A2E] to-[#0B1120] p-10 lg:flex">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex justify-start">
            <BrandMark className="items-start text-left" />
          </div>
          <div className="relative">
            <h2 className="text-2xl font-semibold leading-tight text-white">{t("login.title")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{t("login.subtitle")}</p>
          </div>

          {/* A hand-drawn preview that mirrors the real Reyting (Leaderboard)
              page's layout and labels — not a literal screenshot, but built
              from the same columns/metrics so it represents the product
              honestly. */}
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-elevated">
            <div className="mb-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <p className="text-xs font-semibold text-white/80">{t("lb.title")}</p>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                [t("lb.todayRevenue"), "12.4M", "text-emerald-400"],
                [t("lb.avgConversion"), "31%", "text-teal-300"],
                [t("lb.totalWonLeads"), "58", "text-blue-300"],
                [t("lb.totalRevenue"), "142M", "text-white"],
              ].map(([label, v, c]) => (
                <div key={label} className="rounded-lg bg-white/[0.05] p-2">
                  <p className="truncate text-[9px] font-medium text-white/40">{label}</p>
                  <p className={cn("text-[13px] font-bold", c)}>{v}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-end justify-center gap-2">
              {[
                { i: 1, h: "h-12", ring: "ring-slate-300/70", medal: "bg-slate-300 text-slate-800" },
                { i: 0, h: "h-16", ring: "ring-amber-400/80", medal: "bg-amber-400 text-amber-950" },
                { i: 2, h: "h-9", ring: "ring-orange-700/70", medal: "bg-orange-700 text-orange-50" },
              ].map((p) => (
                <div key={p.i} className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white ring-2",
                      p.ring,
                    )}
                  >
                    {["AS", "DK", "NM"][p.i]}
                  </span>
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold",
                      p.medal,
                    )}
                  >
                    {p.i + 1}
                  </span>
                  <div className={cn("w-9 rounded-t-md bg-gradient-to-t from-emerald-500/50 to-teal-300/60", p.h)} />
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
              {[
                { rank: 1, name: "Aizhan S.", target: 92, bonus: "1.8M" },
                { rank: 2, name: "Doston K.", target: 74, bonus: "1.3M" },
                { rank: 3, name: "Nodira M.", target: 58, bonus: "0.9M" },
              ].map((r) => (
                <div key={r.rank} className="flex items-center gap-2">
                  <span className="w-3.5 shrink-0 text-[11px] font-bold text-amber-400">#{r.rank}</span>
                  <span className="w-16 shrink-0 truncate text-[10px] text-white/70">{r.name}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300"
                      style={{ width: `${r.target}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[10px] font-semibold text-emerald-300">
                    {r.bonus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center overflow-y-auto p-8 sm:p-10 lg:p-14">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background shadow-soft">
                <Logo className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-foreground">{t("app.name")}</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/5 p-1">
              <Globe className="ml-1 h-3.5 w-3.5 shrink-0 text-primary" />
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    lang === l
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {LANG_SHORT[l]}
                </button>
              ))}
            </div>
          </div>

          <h1 className="text-xl font-semibold text-foreground">{t("login.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("login.subtitle")}</p>

          {confirmNotice && (
            <p className="mt-4 rounded-xl bg-info/10 px-3 py-2 text-sm font-medium text-info">
              {t("login.confirmEmailNotice")}
            </p>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
            {mode === "signup" && (
              <label className="block">
                <span className="text-[13px] font-medium text-muted-foreground">
                  {t("login.fullName")}
                </span>
                <span className="relative mt-2 block">
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Aizhan Serikova"
                    aria-invalid={!!errors.fullName}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background"
                  />
                </span>
                {errors.fullName && (
                  <span className="mt-1.5 block text-xs text-destructive">{errors.fullName}</span>
                )}
              </label>
            )}

            <label className="block">
              <span className="text-[13px] font-medium text-muted-foreground">
                {t("login.email")}
              </span>
              <span className="relative mt-2 block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="super@admin.com"
                  aria-invalid={!!errors.email}
                  className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background"
                />
              </span>
              {errors.email && (
                <span className="mt-1.5 block text-xs text-destructive">{errors.email}</span>
              )}
            </label>

            <label className="block">
              <span className="text-[13px] font-medium text-muted-foreground">
                {t("login.password")}
              </span>
              <span className="relative mt-2 block">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background"
                />
              </span>
              {errors.password && (
                <span className="mt-1.5 block text-xs text-destructive">{errors.password}</span>
              )}
            </label>

            {errors.form && (
              <p
                role="alert"
                className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
              >
                {errors.form}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mx-auto flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy
                ? mode === "signin"
                  ? t("login.signingIn")
                  : t("login.creatingAccount")
                : mode === "signin"
                  ? t("login.submit")
                  : t("login.signupSubmit")}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setErrors({});
              setConfirmNotice(false);
            }}
            className="mt-6 block w-full rounded-xl border border-dashed border-border px-3 py-2 text-center text-xs font-medium text-subtle transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {mode === "signin" ? t("login.toggleToSignup") : t("login.toggleToSignin")}
          </button>
        </section>
      </div>
    </main>
  );
}
