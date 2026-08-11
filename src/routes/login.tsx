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
  const { user, ready, recoveryMode, signIn, resetPassword, updatePassword } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const [busy, setBusy] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  useEffect(() => {
    if (ready && user && !recoveryMode) void navigate({ to: "/", replace: true });
  }, [ready, user, recoveryMode, navigate]);

  async function onForgotSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!EMAIL_RE.test(forgotEmail.trim())) {
      setRecoveryError("");
      setForgotError(t("login.invalidEmail"));
      return;
    }
    setForgotBusy(true);
    setForgotError("");
    const result = await resetPassword(forgotEmail);
    setForgotBusy(false);
    if (!result.ok) {
      setForgotError(result.error);
      return;
    }
    setForgotSent(true);
  }

  async function onRecoverySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setRecoveryError(t("login.shortPassword"));
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setRecoveryError(t("login.passwordMismatch"));
      return;
    }
    setRecoveryBusy(true);
    setRecoveryError("");
    const result = await updatePassword(newPassword);
    setRecoveryBusy(false);
    if (!result.ok) {
      setRecoveryError(result.error);
      return;
    }
    toast.success(t("login.passwordUpdated"));
    void navigate({ to: "/", replace: true });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = t("login.invalidEmail");
    if (password.length < 8) next.password = t("login.shortPassword");
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);

    if (!result.ok) {
      setErrors({ form: signInErrorMessage(result.error, t) });
      return;
    }

    toast.success(t("login.success"));
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

          <div className="relative flex justify-center">
            <BrandMark
              className="items-center text-center"
              iconClassName="h-24 w-24 sm:h-28 sm:w-28"
              wordmarkClassName="text-3xl sm:text-4xl"
            />
          </div>
          <div className="relative text-center">
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
            <div className="rounded-t-2xl border border-white/10 bg-[#04070f] p-4 shadow-elevated">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="ml-2 truncate rounded-md bg-white/[0.06] px-2.5 py-1 text-xs text-white/30">
                  app.salesos.uz/reyting
                </span>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  <p className="text-base font-semibold text-white/80">{t("lb.title")}</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { initials: "MR", name: "Mavjuda R.", crown: true },
                    { initials: "MR", name: "Munira R.", crown: false },
                    { initials: "NI", name: "Nilufar I.", crown: false },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border p-3",
                        p.crown
                          ? "border-amber-400/50 bg-amber-400/[0.07]"
                          : "border-white/10 bg-white/[0.04]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                          {p.initials}
                        </span>
                        <span className="truncate text-sm font-semibold text-white/80">
                          {p.name}
                        </span>
                        {p.crown && <span className="ml-auto shrink-0 text-base">👑</span>}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-1.5">
                        <div>
                          <p className="text-[10px] text-white/35">{t("lb.colRevenue")}</p>
                          <p className="text-sm font-bold text-emerald-300">UZS 0</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/35">{t("lb.colWonLeads")}</p>
                          <p className="text-sm font-bold text-white">0</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mb-2.5 mt-5 text-xs font-semibold uppercase tracking-wide text-white/40">
                  {t("lb.liveRanking2")}
                </p>
                <div className="space-y-3 border-t border-white/10 pt-3">
                  {[
                    { rank: 1, name: "Mavjuda R.", target: 92, bonus: "1.8M" },
                    { rank: 2, name: "Munira R.", target: 74, bonus: "1.3M" },
                    { rank: 3, name: "Nilufar I.", target: 58, bonus: "0.9M" },
                  ].map((r) => (
                    <div key={r.rank} className="flex items-center gap-3">
                      <span className="w-5 shrink-0 text-sm font-bold text-amber-400">
                        #{r.rank}
                      </span>
                      <span className="w-24 shrink-0 truncate text-sm text-white/65">{r.name}</span>
                      <div className="h-2 flex-1 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300"
                          style={{ width: `${r.target}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-sm font-semibold text-emerald-300">
                        {r.bonus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* monitor stand */}
            <div className="mx-auto h-4 w-20 bg-[#04070f]" />
            <div className="mx-auto h-2 w-36 rounded-full bg-[#04070f]" />
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

          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex flex-col items-center text-center">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-border bg-background shadow-soft">
                <Logo className="h-11 w-11" />
              </span>
              <p className="mt-4 text-3xl font-bold text-foreground">SalesOS Elite CRM</p>
              <p className="mt-2 text-base font-bold uppercase tracking-wide text-primary">
                {t("login.subtitle")}
              </p>
            </div>

            {recoveryMode ? (
              <form onSubmit={onRecoverySubmit} noValidate className="space-y-5">
                <p className="text-center text-sm text-muted-foreground">
                  {t("login.setNewPasswordDesc")}
                </p>
                <label className="block">
                  <span className="text-[13px] font-medium text-muted-foreground">
                    {t("login.newPassword")}
                  </span>
                  <span className="relative mt-2 block">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-14 w-full rounded-xl border border-border bg-surface pl-11 pr-3 text-base outline-none transition-colors focus:border-primary/50 focus:bg-background"
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="text-[13px] font-medium text-muted-foreground">
                    {t("login.newPasswordConfirm")}
                  </span>
                  <span className="relative mt-2 block">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="h-14 w-full rounded-xl border border-border bg-surface pl-11 pr-3 text-base outline-none transition-colors focus:border-primary/50 focus:bg-background"
                    />
                  </span>
                </label>
                {recoveryError && (
                  <p
                    role="alert"
                    className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
                  >
                    {recoveryError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={recoveryBusy}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {recoveryBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("login.updatePassword")}
                </button>
              </form>
            ) : forgotOpen ? (
              <div className="space-y-5">
                {forgotSent ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                    <p className="text-sm text-foreground">
                      {t("login.forgotSent", { email: forgotEmail })}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={onForgotSubmit} noValidate className="space-y-5">
                    <p className="text-center text-sm text-muted-foreground">
                      {t("login.forgotDesc")}
                    </p>
                    <label className="block">
                      <span className="text-[13px] font-medium text-muted-foreground">
                        {t("login.email")}
                      </span>
                      <span className="relative mt-2 block">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                        <input
                          type="email"
                          autoComplete="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="super@admin.com"
                          className="h-14 w-full rounded-xl border border-border bg-surface pl-11 pr-3 text-base outline-none transition-colors focus:border-primary/50 focus:bg-background"
                        />
                      </span>
                    </label>
                    {forgotError && (
                      <p
                        role="alert"
                        className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
                      >
                        {forgotError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={forgotBusy}
                      className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {forgotBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t("login.sendResetLink")}
                    </button>
                  </form>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setForgotOpen(false);
                    setForgotSent(false);
                    setForgotError("");
                  }}
                  className="block w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {t("login.backToSignIn")}
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={onSubmit} noValidate className="space-y-5">
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
                      <span className="mt-1.5 block text-xs text-destructive">
                        {errors.password}
                      </span>
                    )}
                    <span className="mt-2 block text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setForgotOpen(true);
                          setForgotSent(false);
                          setForgotError("");
                        }}
                        className="text-[13px] font-medium text-primary hover:underline"
                      >
                        {t("login.forgotPassword")}
                      </button>
                    </span>
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
                    className="mx-auto flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? t("login.signingIn") : t("login.submit")}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
