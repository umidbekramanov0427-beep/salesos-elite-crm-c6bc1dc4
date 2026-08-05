import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SessionUser = {
  email: string;
  name: string;
  initials: string;
  role: "super_admin" | "manager" | "rep";
};

const STORAGE_KEY = "salesos.session";

const CREDENTIALS = { email: "super@admin.com", password: "12345678" };

const SUPER_ADMIN: SessionUser = {
  email: CREDENTIALS.email,
  name: "Aizhan Serikova",
  initials: "AS",
  role: "super_admin",
};

type AuthValue = {
  user: SessionUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as SessionUser);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 350));
    const ok =
      email.trim().toLowerCase() === CREDENTIALS.email && password === CREDENTIALS.password;
    if (!ok) return false;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SUPER_ADMIN));
    setUser(SUPER_ADMIN);
    return true;
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
