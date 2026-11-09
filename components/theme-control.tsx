"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, readTheme, saveTheme, THEME_EVENT, THEME_KEY, THEME_QUERY, type ThemePreference } from "@/lib/theme";

export default function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  useEffect(() => {
    const sync = () => {
      const next = readTheme();
      applyTheme(next);
      setPreference(next);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) sync();
    };
    const media = window.matchMedia(THEME_QUERY);
    sync();
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", storage);
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", storage);
      media.removeEventListener("change", sync);
    };
  }, []);
  const Icon = preference === "system" ? Monitor : preference === "dark" ? Moon : Sun;
  return <label className="theme-control">
    <Icon size={16} aria-hidden="true" />
    <span className="sr-only">Tema tampilan</span>
    <select value={preference} onChange={event => saveTheme(event.target.value as ThemePreference)}>
      <option value="system">Sistem</option>
      <option value="light">Terang</option>
      <option value="dark">Gelap</option>
    </select>
  </label>;
}
