import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
  }
  return preference;
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
}

type ThemeStore = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  init: () => Promise<void>;
};

let initialized = false;

export const useThemeStore = create<ThemeStore>((set, get) => ({
  preference: "system",
  resolved: "dark",

  // Theme is changed exclusively via the native "View" menu (Rust is the
  // source of truth, in theme.json) — this just reads the current value and
  // stays in sync afterward. Safe to call once per window; re-entrant calls
  // from other components mounting are no-ops.
  init: async () => {
    if (initialized) return;
    initialized = true;

    const applyPreference = (preference: ThemePreference) => {
      const resolved = resolveTheme(preference);
      set({ preference, resolved });
      applyTheme(resolved);
    };

    try {
      const preference = await invoke<ThemePreference>("load_theme_preference");
      applyPreference(preference);
    } catch (err) {
      console.error("Could not load theme preference:", err);
      applyPreference("system");
    }

    listen<ThemePreference>("zpay://theme-changed", (event) => {
      applyPreference(event.payload);
    });

    window.matchMedia(DARK_MEDIA_QUERY).addEventListener("change", () => {
      if (get().preference === "system") {
        applyPreference("system");
      }
    });
  },
}));
