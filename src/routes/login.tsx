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
  const [linkExpiredNotice, setLinkExpiredNotice] = useState(false);

  useEffect(() => {
    if (ready && user && !recoveryMode) void navigate({ to: "/", replace: true });
  }, [ready, user, recoveryMode, navigate]);

  // Supabase redirects an expired/already-used recovery link back here with
  // the error encoded in the URL hash rather than delivering a session —
  // without this, the page just silently falls through to the normal
  // sign-in form and the user sees a confusing "wrong email/password".
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=") && hash.includes("otp_expired")) {
      setLinkExpiredNotice(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

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
    <main className="h-screen w-full overflow-hidden bg-[#0B1120]">
      <div className="grid h-full w-full lg:grid-cols-2">
        <section className="relative hidden flex-col justify-between gap-8 overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0E1A2E] to-[#0B1120] p-10 lg:flex">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative">
            <BrandMark
              className="items-start text-left"
              iconClassName="h-12 w-12"
              wordmarkClassName="text-xl"
            />
          </div>

          <div className="relative max-w-md">
            <h2 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
              {t("login.title")}
            </h2>
            <p className="mt-4 text-base font-medium tracking-wide text-emerald-300/80 sm:text-lg">
              {t("login.tagline")}
            </p>
          </div>

          {/* Decorative wave graphic — deliberately abstract rather than a
              literal product screenshot, so the branding panel reads as a
              calm, confident backdrop instead of competing with the form. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 800 320"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-56 w-full"
          >
            <defs>
              <linearGradient id="loginWave1" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2DD4BF" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
              <linearGradient id="loginWave2" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#2DD4BF" />
              </linearGradient>
            </defs>
            <path
              d="M0,180 C120,140 220,220 340,190 C460,160 540,110 660,140 C720,155 760,175 800,170 L800,320 L0,320 Z"
              fill="url(#loginWave1)"
              opacity="0.12"
            />
            <path
              d="M0,220 C140,200 240,250 360,225 C480,200 560,170 680,195 C730,207 770,215 800,210 L800,320 L0,320 Z"
              fill="url(#loginWave2)"
              opacity="0.16"
            />
            <path
              d="M0,260 C160,245 260,280 380,262 C500,244 580,225 700,240 C740,246 770,252 800,248 L800,320 L0,320 Z"
              fill="url(#loginWave1)"
              opacity="0.22"
            />
          </svg>
        </section>

        <section className="relative flex flex-col justify-center overflow-y-auto bg-[#0B1120] p-8 sm:p-10 lg:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl lg:hidden" />

          <div className="relative mb-6 flex items-center justify-end">
            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-1">
              <Globe className="ml-1 h-3.5 w-3.5 shrink-0 text-teal-300" />
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    lang === l
                      ? "bg-primary text-primary-foreground"
                      : "text-white/50 hover:bg-white/10",
                  )}
                >
                  {LANG_SHORT[l]}
                </button>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Logo className="h-6 w-6" />
              </span>
              <p className="text-lg font-bold text-white">SalesOS Elite CRM</p>
            </div>

            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white">{t("login.welcomeBack")}</h1>
              <p className="mt-2 text-sm text-white/50">{t("login.welcomeBackDesc")}</p>
            </div>

            {recoveryMode ? (
              <form onSubmit={onRecoverySubmit} noValidate className="space-y-5">
                <p className="text-center text-sm text-white/50">{t("login.setNewPasswordDesc")}</p>
                <label className="block">
                  <span className="text-[13px] font-medium text-white/60">
                    {t("login.newPassword")}
                  </span>
                  <span className="relative mt-2 block">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-3 text-base text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/50 focus:bg-white/10"
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="text-[13px] font-medium text-white/60">
                    {t("login.newPasswordConfirm")}
                  </span>
                  <span className="relative mt-2 block">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-3 text-base text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/50 focus:bg-white/10"
                    />
                  </span>
                </label>
                {recoveryError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-destructive/30 bg-destructive/15 px-3 py-2 text-sm font-medium text-red-300"
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
                  <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
                    <p className="text-sm text-white">
                      {t("login.forgotSent", { email: forgotEmail })}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={onForgotSubmit} noValidate className="space-y-5">
                    <p className="text-center text-sm text-white/50">{t("login.forgotDesc")}</p>
                    <label className="block">
                      <span className="text-[13px] font-medium text-white/60">
                        {t("login.email")}
                      </span>
                      <span className="relative mt-2 block">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                        <input
                          type="email"
                          autoComplete="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="super@admin.com"
                          className="h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-3 text-base text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/50 focus:bg-white/10"
                        />
                      </span>
                    </label>
                    {forgotError && (
                      <p
                        role="alert"
                        className="rounded-xl border border-destructive/30 bg-destructive/15 px-3 py-2 text-sm font-medium text-red-300"
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
                  className="block w-full text-center text-sm font-medium text-white/50 hover:text-white"
                >
                  {t("login.backToSignIn")}
                </button>
              </div>
            ) : (
              <>
                {linkExpiredNotice && (
                  <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-200">
                    <p>{t("login.recoveryLinkExpired")}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkExpiredNotice(false);
                        setForgotEmail(email);
                        setForgotOpen(true);
                        setForgotSent(false);
                        setForgotError("");
                      }}
                      className="mt-1.5 font-semibold text-primary hover:underline"
                    >
                      {t("login.forgotPassword")}
                    </button>
                  </div>
                )}
                <form onSubmit={onSubmit} noValidate className="space-y-5">
                  <label className="block">
                    <span className="text-[13px] font-medium text-white/60">
                      {t("login.email")}
                    </span>
                    <span className="relative mt-2 block">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="super@admin.com"
                        aria-invalid={!!errors.email}
                        className="h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-3 text-base text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/50 focus:bg-white/10"
                      />
                    </span>
                    {errors.email && (
                      <span className="mt-1.5 block text-xs text-red-300">{errors.email}</span>
                    )}
                  </label>

                  <label className="block">
                    <span className="text-[13px] font-medium text-white/60">
                      {t("login.password")}
                    </span>
                    <span className="relative mt-2 block">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        aria-invalid={!!errors.password}
                        className="h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-3 text-base text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/50 focus:bg-white/10"
                      />
                    </span>
                    {errors.password && (
                      <span className="mt-1.5 block text-xs text-red-300">{errors.password}</span>
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
                      className="rounded-xl border border-destructive/30 bg-destructive/15 px-3 py-2 text-sm font-medium text-red-300"
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
