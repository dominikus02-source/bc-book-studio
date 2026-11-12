"use client";

import { useEffect, useState } from "react";

type ThemeName = "light" | "dark";

function readTheme(): ThemeName {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: ThemeName, persist: boolean) {
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem("bcstudio-theme", theme);
  window.dispatchEvent(new Event("bc-theme-change"));
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>("light");

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    sync();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (localStorage.getItem("bcstudio-theme")) return;
      applyTheme(media.matches ? "dark" : "light", false);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "bcstudio-theme") return;
      if (event.newValue !== "dark" && event.newValue !== "light") return;
      applyTheme(event.newValue, false);
    };
    window.addEventListener("bc-theme-change", sync);
    window.addEventListener("storage", onStorage);
    media.addEventListener("change", onScheme);
    return () => {
      window.removeEventListener("bc-theme-change", sync);
      window.removeEventListener("storage", onStorage);
      media.removeEventListener("change", onScheme);
    };
  }, []);

  return (
    <button
      type="button"
      className="lp-theme"
      aria-pressed={theme === "dark"}
      onClick={() => {
        const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        applyTheme(current === "dark" ? "light" : "dark", true);
      }}
    >
      <span className="lp-theme-light">Terang</span>
      <span className="lp-theme-dark">Gelap</span>
    </button>
  );
}
