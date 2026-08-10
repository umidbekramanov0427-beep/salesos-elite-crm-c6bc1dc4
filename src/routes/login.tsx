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
            <h2 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
              {t("login.title")}
            </h2>
            <p className="mt-4 text-base font-medium tracking-wide text-emerald-300/80 sm:text-lg">
              {t("login.tagline")}
            </p>
          </div>

          {/* A hand-drawn preview that mirrors the real Reyting (Leaderboard)
              page's podium + live-ranking table — not a literal screenshot,
              but built from the same fields, framed as if inside a monitor
              so the branding panel reads as "this is the real product". */}
          <div className="relative">
            <div className="rounded-t-2xl border border-white/10 bg-[#04070f] p-2.5 shadow-elevated">
              <div className="mb-2 flex items-center gap-1.5 px-1">
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="ml-2 truncate rounded-md bg-white/[0.06] px-2 py-0.5 text-[9px] text-white/30">
                  app.salesos.uz/reyting
                </span>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <p className="text-xs font-semibold text-white/80">{t("lb.title")}</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { initials: "MR", name: "Mavjuda R.", crown: true },
                    { initials: "MR", name: "Munira R.", crown: false },
                    { initials: "NI", name: "Nilufar I.", crown: false },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border p-2",
                        p.crown
                          ? "border-amber-400/50 bg-amber-400/[0.07]"
                          : "border-white/10 bg-white/[0.04]",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-300">
                          {p.initials}
                        </span>
                        <span className="truncate text-[10px] font-semibold text-white/80">
                          {p.name}
                        </span>
                        {p.crown && <span className="ml-auto shrink-0 text-xs">👑</span>}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        <div>
                          <p className="text-[7px] text-white/35">{t("lb.colRevenue")}</p>
                          <p className="text-[9px] font-bold text-emerald-300">UZS 0</p>
                        </div>
                        <div>
                          <p className="text-[7px] text-white/35">{t("lb.colWonLeads")}</p>
                          <p className="text-[9px] font-bold text-white">0</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mb-1.5 mt-3 text-[9px] font-semibold uppercase tracking-wide text-white/40">
                  {t("lb.liveRanking2")}
                </p>
                <div className="space-y-1.5 border-t border-white/10 pt-2">
                  {[
                    { rank: 1, name: "Mavjuda R.", target: 92, bonus: "1.8M" },
                    { rank: 2, name: "Munira R.", target: 74, bonus: "1.3M" },
                    { rank: 3, name: "Nilufar I.", target: 58, bonus: "0.9M" },
                  ].map((r) => (
                    <div key={r.rank} className="flex items-center gap-2">
                      <span className="w-4 shrink-0 text-[10px] font-bold text-amber-400">
                        #{r.rank}
                      </span>
                      <span className="w-16 shrink-0 truncate text-[9px] text-white/65">
                        {r.name}
                      </span>
                      <div className="h-1 flex-1 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300"
                          style={{ width: `${r.target}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-[9px] font-semibold text-emerald-300">
                        {r.bonus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* monitor stand */}
            <div className="mx-auto h-3 w-14 bg-[#04070f]" />
            <div className="mx-auto h-1.5 w-24 rounded-full bg-[#04070f]" />
          </div>
        </section>

        <section className="flex flex-col justify-center overflow-y-auto p-8 sm:p-10 lg:p-14">
          <div className="mb-6 flex items-center justify-end">
            <div className="flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/5 p-1">
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

          <div className="mx-auto w-full max-w-sm">
            <div className="mb-7 flex flex-col items-center text-center">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-background shadow-soft">
                <Logo className="h-9 w-9" />
              </span>
              <p className="mt-3 text-2xl font-bold text-foreground">SalesOS Elite CRM</p>
            </div>

            <h1 className="text-center text-xl font-semibold text-foreground">
              {t("login.title")}
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">{t("login.subtitle")}</p>

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
                      className="h-14 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none transition-colors focus:border-primary/50 focus:bg-background"
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
                    className="h-14 w-full rounded-xl border border-border bg-surface pl-11 pr-3 text-base outline-none transition-colors focus:border-primary/50 focus:bg-background"
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
                    className="h-14 w-full rounded-xl border border-border bg-surface pl-11 pr-3 text-base outline-none transition-colors focus:border-primary/50 focus:bg-background"
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
              className="mt-6 block w-full rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-2.5 text-center text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-400/25 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20"
            >
              {mode === "signin" ? t("login.toggleToSignup") : t("login.toggleToSignin")}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
