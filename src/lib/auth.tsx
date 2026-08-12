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
  dailyTarget: number;
  monthlyTarget: number;
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
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) await hydrate(data.session.user.id);
      if (mounted.current) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (session?.user) {
        void hydrate(session.user.id).finally(() => {
          if (mounted.current) setReady(true);
        });
      } else {
        setUser(null);
        setReady(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [hydrate]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

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
