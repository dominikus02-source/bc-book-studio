/** Shared browser theme contract. No writes on mount: system remains the default. */
export type ThemePreference = "system" | "light" | "dark";
export const THEME_KEY = "bcstudio-theme";
export const THEME_EVENT = "bc-theme-change";
export const THEME_QUERY = "(prefers-color-scheme: dark)";

export function parseTheme(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
export function resolveTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}
export function readTheme(): ThemePreference {
  try { return parseTheme(window.localStorage.getItem(THEME_KEY)); }
  catch { return parseTheme(document.documentElement.dataset.themePreference ?? null); }
}
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  const theme = resolveTheme(preference, window.matchMedia(THEME_QUERY).matches);
  root.dataset.themePreference = preference;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
export function saveTheme(preference: ThemePreference): void {
  applyTheme(preference);
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, preference);
  } catch { /* The current tab still works when storage is unavailable. */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}

// Synchronous head script, before content paint. Keep independent of hydration.
// Storage failure must not prevent following the operating-system preference.
export const themeBootstrap = `(()=>{let p="system";try{const v=localStorage.getItem("${THEME_KEY}");if(v==="dark"||v==="light")p=v}catch{}const d=p==="dark"||(p==="system"&&matchMedia("${THEME_QUERY}").matches);const r=document.documentElement;r.dataset.themePreference=p;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light"})()`;
