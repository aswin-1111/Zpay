export type AiProvider = "openai" | "anthropic";

// Mirrors Rust's AiSettingsPublic (src-tauri/src/lib.rs) — never carries the
// real API key, just enough to prefill the settings form and to let other
// windows know whether AI features are usable yet.
export type AiSettingsPublic = {
  provider: AiProvider;
  baseUrl: string | null;
  model: string;
  hasKey: boolean;
};
