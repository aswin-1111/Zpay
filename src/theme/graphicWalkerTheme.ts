import type { IUIThemeConfig } from "@kanaries/graphic-walker";

// Mirrors the dark palette in App.css (:root tokens). GraphicWalker's theme
// config computes derived shades from these values internally, so they need
// to be literal colors, not var(--...) references. Keep in sync with App.css.
const zpayColorSet = {
  background: "#222222", // --color-bg-secondary
  foreground: "#dfdfdf", // --color-fg-primary
  card: "#2f2f2f", // --color-bg-tertiary
  "card-foreground": "#dfdfdf",
  popover: "#2f2f2f",
  "popover-foreground": "#dfdfdf",
  primary: "#e4d03c", // --color-accent
  "primary-foreground": "#0f0f0f", // --color-accent-contrast
  muted: "#2f2f2f",
  "muted-foreground": "#a8a8a8",
  secondary: "#2f2f2f",
  "secondary-foreground": "#dfdfdf",
  accent: "#3a3a3a",
  "accent-foreground": "#dfdfdf",
  destructive: "#4a1b0c",
  "destructive-foreground": "#f0997b",
  border: "#3a3a3a",
  input: "#3a3a3a",
  ring: "#e4d03c",
};

// The app only ever renders GraphicWalker with appearance="dark", but
// IUIThemeConfig requires both variants — reuse the same palette for light.
export const zpayGwUiTheme: IUIThemeConfig = {
  dark: zpayColorSet,
  light: zpayColorSet,
};
