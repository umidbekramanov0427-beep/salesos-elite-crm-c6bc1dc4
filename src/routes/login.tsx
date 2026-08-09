import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, Mail } from "lucide-react";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4 py-10">
      <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[460px] w-[460px] rounded-full bg-mint blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-background/70 shadow-soft backdrop-blur-xl lg:grid-cols-2">
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
          <dl className="relative grid grid-cols-2 gap-4">
            {[
              ["240+", t("lb.title")],
              ["3s", t("lb.live")],
              ["10", t("lb.type")],
              ["16", t("int.title")],
            ].map(([v, k]) => (
              <div key={k as string} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <dt className="text-lg font-semibold text-white">{v}</dt>
                <dd className="text-[11px] text-white/50">{k}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="p-8 sm:p-10">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background shadow-soft">
                <Logo className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-foreground">{t("app.name")}</p>
            </div>
            <div className="ml-auto flex items-center gap-1 rounded-xl border border-border p-1">
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
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
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
