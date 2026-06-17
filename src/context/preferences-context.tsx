"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type FontSizeSetting = "normal" | "large" | "extra-large";
export type ThemeSetting = "light" | "dark" | "high-contrast";

type PreferencesContextValue = {
  fontSize: FontSizeSetting;
  setFontSize: (v: FontSizeSetting) => void;
  theme: ThemeSetting;
  setTheme: (v: ThemeSetting) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const STORAGE_KEY = "tracker.preferences.v1";

function loadInitialPreferences(): { fontSize: FontSizeSetting; theme: ThemeSetting } {
  if (typeof window === "undefined") return { fontSize: "normal", theme: "light" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { fontSize: "normal", theme: "light" };
    const parsed = JSON.parse(raw) as Partial<{
      fontSize: FontSizeSetting;
      theme: ThemeSetting;
    }>;
    return {
      fontSize: parsed.fontSize ?? "normal",
      theme: parsed.theme ?? "light",
    };
  } catch {
    return { fontSize: "normal", theme: "light" };
  }
}

function toRootClasses(fontSize: FontSizeSetting, theme: ThemeSetting) {
  const fontClass =
    fontSize === "normal"
      ? "font-normal"
      : fontSize === "large"
        ? "font-large"
        : "font-extra-large";

  const themeClass =
    theme === "light"
      ? "theme-light"
      : theme === "dark"
        ? "theme-dark"
        : "theme-high-contrast";

  return { fontClass, themeClass };
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(() => loadInitialPreferences(), []);
  const [fontSize, setFontSize] = useState<FontSizeSetting>(initial.fontSize);
  const [theme, setTheme] = useState<ThemeSetting>(initial.theme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ fontSize, theme }));
    } catch {
      // ignore
    }
  }, [fontSize, theme]);

  useEffect(() => {
    const root = document.documentElement;
    const { fontClass, themeClass } = toRootClasses(fontSize, theme);
    root.classList.remove(
      "font-normal",
      "font-large",
      "font-extra-large",
      "theme-light",
      "theme-dark",
      "theme-high-contrast",
    );
    root.classList.add(fontClass, themeClass);
  }, [fontSize, theme]);

  const value = useMemo(
    () => ({ fontSize, setFontSize, theme, setTheme }),
    [fontSize, theme],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}

