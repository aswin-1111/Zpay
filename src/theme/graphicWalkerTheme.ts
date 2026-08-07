import type { IUIThemeConfig } from "@kanaries/graphic-walker";

// Mirrors the dark/light palettes in App.css (:root / :root[data-theme="light"]
// tokens). GraphicWalker's theme config computes derived shades from these
// internally, so they need to be literal colors, not var(--...) references.
// Keep in sync with App.css. GraphicWalker picks between the two sub-palettes
// itself based on the `appearance` prop passed alongside this config.
const zpayDarkColorSet = {
  background: "#222222", // --color-bg-secondary (dark)
  foreground: "#dfdfdf", // --color-fg-primary (dark)
  card: "#2f2f2f", // --color-bg-tertiary (dark)
  "card-foreground": "#dfdfdf",
  popover: "#2f2f2f",
  "popover-foreground": "#dfdfdf",
  primary: "#e4d03c", // --color-accent (dark)
  "primary-foreground": "#0f0f0f", // --color-accent-contrast
  muted: "#2f2f2f",
  "muted-foreground": "#a8a8a8",
  secondary: "#2f2f2f",
  "secondary-foreground": "#dfdfdf",
  accent: "#3a3a3a",
  "accent-foreground": "#dfdfdf",
  destructive: "#4a1b0c", // --color-danger-bg (dark)
  "destructive-foreground": "#f0997b", // --color-danger-fg (dark)
  border: "#3a3a3a",
  input: "#3a3a3a",
  ring: "#e4d03c",
};

const zpayLightColorSet = {
  background: "#ffffff", // --color-bg-secondary (light)
  foreground: "#1b1b1b", // --color-fg-primary (light)
  card: "#ececec", // --color-bg-tertiary (light)
  "card-foreground": "#1b1b1b",
  popover: "#ececec",
  "popover-foreground": "#1b1b1b",
  primary: "#c9a600", // --color-accent (light)
  "primary-foreground": "#0f0f0f",
  muted: "#ececec",
  "muted-foreground": "#6b6b6b",
  secondary: "#ececec",
  "secondary-foreground": "#1b1b1b",
  accent: "#dedede",
  "accent-foreground": "#1b1b1b",
  destructive: "#fdeceb", // --color-danger-bg (light)
  "destructive-foreground": "#b3261e", // --color-danger-fg (light)
  border: "#dedede",
  input: "#dedede",
  ring: "#c9a600",
};

export const zpayGwUiTheme: IUIThemeConfig = {
  dark: zpayDarkColorSet,
  light: zpayLightColorSet,
};
