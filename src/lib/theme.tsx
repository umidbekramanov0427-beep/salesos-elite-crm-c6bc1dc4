import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "salesos.theme";

type ThemeValue = {
  dark: boolean;
  setDark: (v: boolean) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState(readInitial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }, [dark]);

  const setDark = (v: boolean) => setDarkState(v);
  const toggle = () => setDarkState((v) => !v);

  return (
    <ThemeContext.Provider value={{ dark, setDark, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
