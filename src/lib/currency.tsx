import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export const CURRENCIES = ["USD", "UZS"] as const;
export type CurrencyUnit = (typeof CURRENCIES)[number];

// Fixed approximate rate — good enough for in-app display, not for real FX.
const UZS_PER_USD = 12900;

const STORAGE_KEY = "salesos.currency";

type CurrencyValue = {
  unit: CurrencyUnit;
  setUnit: (u: CurrencyUnit) => void;
  format: (usdAmount: number) => string;
};

const CurrencyContext = createContext<CurrencyValue | null>(null);

function readInitial(): CurrencyUnit {
  if (typeof window === "undefined") return "USD";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "UZS" ? "UZS" : "USD";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<CurrencyUnit>(readInitial);

  const setUnit = useCallback((u: CurrencyUnit) => {
    setUnitState(u);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, u);
  }, []);

  const format = useCallback(
    (usdAmount: number) => {
      if (unit === "UZS") {
        return new Intl.NumberFormat("uz-UZ", {
          style: "currency",
          currency: "UZS",
          maximumFractionDigits: 0,
        }).format(usdAmount * UZS_PER_USD);
      }
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(usdAmount);
    },
    [unit],
  );

  const value = useMemo(() => ({ unit, setUnit, format }), [unit, setUnit, format]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>");
  return ctx;
}
