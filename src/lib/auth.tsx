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
  department: string;
  position: string;
  avatarUrl: string | null;
  dailyTarget: number;
  monthlyTarget: number;
};

type AuthResult = { ok: true } | { ok: false; error: string };

type AuthValue = {
  user: SessionUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<AuthResult & { needsEmailConfirm?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
    department: profile.department,
    position: profile.position,
    avatarUrl: profile.avatar_url,
    dailyTarget: profile.daily_target,
    monthlyTarget: profile.monthly_target,
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, needsEmailConfirm: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) await hydrate(data.session.user.id);
  }, [hydrate]);

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signOut, refreshProfile }),
    [user, ready, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
