import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: Profile["role"];
  managerId: string | null;
  organizationId: string | null;
  department: string;
  position: string;
  phone: string | null;
  avatarUrl: string | null;
  dailyTarget: number | null;
  monthlyTarget: number | null;
  telegramLinked: boolean;
};

type AuthResult = { ok: true } | { ok: false; error: string };

type AuthValue = {
  user: SessionUser | null;
  ready: boolean;
  // True while the session was opened by a password-recovery email link —
  // the login screen uses this to show a "set new password" form instead
  // of redirecting straight into the app like a normal sign-in would.
  recoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (newPassword: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthValue | null>(null);

function initialsOf(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function toSessionUser(profile: Profile): SessionUser {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.full_name || profile.email,
    initials: initialsOf(profile.full_name, profile.email),
    role: profile.role,
    managerId: profile.manager_id,
    organizationId: profile.organization_id,
    department: profile.department,
    position: profile.position,
    phone: profile.phone,
    avatarUrl: profile.avatar_url,
    dailyTarget: profile.daily_target,
    monthlyTarget: profile.monthly_target,
    telegramLinked: profile.telegram_chat_id != null,
  };
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const mounted = useRef(true);
  // Tracks whose session is currently hydrated, so a re-emitted SIGNED_IN
  // for the *same* user (see the onAuthStateChange comment below) can be
  // told apart from an actual sign-in by a different one.
  const lastUserIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A DB trigger creates the profile row on signup; it can lag by a beat on
  // the very first sign-in, so retry briefly instead of failing outright.
  const hydrate = useCallback(async (userId: string) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const profile = await fetchProfile(userId);
      if (profile) {
        if (mounted.current) setUser(toSessionUser(profile));
        return;
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    if (mounted.current) setUser(null);
  }, []);

  useEffect(() => {
    // Both this call AND onAuthStateChange fire once for whatever session
    // already exists on mount -- that used to mean two independent hydrate()
    // + setReady(true) calls for the *same* user, racing each other, and
    // whichever resolved last could overwrite an already-correct user with
    // null moments after a correct render (sending AuthGate to /login, then
    // login.tsx's own "already signed in" effect bounced it to "/", losing
    // whatever page e.g. /funnels was actually open). Removing this call
    // entirely (an earlier attempt at this fix) turned out to be worse --
    // login got stuck permanently on some loads, so onAuthStateChange's
    // initial fire alone isn't reliably sufficient here. Instead, both
    // paths now check lastUserIdRef the same way: whichever fires first
    // claims the hydrate; the other is a same-identity no-op that still
    // calls setReady(true) (idempotent).
    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUserId = data.session?.user?.id ?? null;
      if (sessionUserId && sessionUserId !== lastUserIdRef.current) {
        lastUserIdRef.current = sessionUserId;
        await hydrate(sessionUserId);
      }
      if (mounted.current) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);

      const sessionUserId = session?.user?.id ?? null;
      const isNewIdentity = sessionUserId !== lastUserIdRef.current;

      // A real sign-in or sign-out changes which organization's data every
      // query is allowed to return. Without clearing the cache here, the
      // previous account's leads/deals/dashboard numbers stayed in memory
      // and rendered immediately for whoever logged in next in the same
      // tab (e.g. a platform owner creating one org, then logging into
      // it) -- query keys aren't organization-scoped, so RLS alone
      // doesn't stop React Query from serving what it already cached.
      //
      // SIGNED_IN isn't only a real login, though -- supabase-js re-emits
      // it (not just TOKEN_REFRESHED) every time the tab regains focus
      // after sitting in the background, even for the exact same session.
      // Clearing on every one of those turned "switch tabs for a few
      // seconds and come back" into every open page reloading from
      // scratch. Only a genuine identity change should blow away the
      // cache and re-fetch the profile below.
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && isNewIdentity)) {
        queryClient.clear();
      }

      if (session?.user) {
        if (isNewIdentity) {
          lastUserIdRef.current = session.user.id;
          void hydrate(session.user.id).finally(() => {
            if (mounted.current) setReady(true);
          });
        } else if (mounted.current) {
          setReady(true);
        }
      } else {
        lastUserIdRef.current = null;
        setUser(null);
        setReady(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [hydrate, queryClient]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) await hydrate(data.session.user.id);
  }, [hydrate]);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    setRecoveryMode(false);
    return { ok: true };
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      recoveryMode,
      signIn,
      signOut,
      refreshProfile,
      resetPassword,
      updatePassword,
    }),
    [user, ready, recoveryMode, signIn, signOut, refreshProfile, resetPassword, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
