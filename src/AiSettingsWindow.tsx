import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import type { AiProvider, AiSettingsPublic } from "./types/ai";

const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
};

export default function AiSettingsWindow() {
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState(DEFAULT_MODEL.openai);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<AiSettingsPublic | null>("load_ai_settings_public")
      .then((settings) => {
        if (settings) {
          setProvider(settings.provider);
          setModel(settings.model);
          setBaseUrl(settings.baseUrl ?? "");
          setHasKey(settings.hasKey);
        }
      })
      .catch((err) => console.error("Could not load AI settings:", err))
      .finally(() => setLoaded(true));
  }, []);

  const handleProviderChange = (next: AiProvider) => {
    // Only swap in the new provider's default model if the model field still
    // matches the old provider's default — leaves a hand-typed model alone.
    setModel((current) => (current === DEFAULT_MODEL[provider] ? DEFAULT_MODEL[next] : current));
    setProvider(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await invoke("save_ai_settings", {
        provider,
        apiKey: apiKeyDraft.trim() ? apiKeyDraft.trim() : null,
        baseUrl: baseUrl.trim() ? baseUrl.trim() : null,
        model: model.trim() || DEFAULT_MODEL[provider],
      });
      await getCurrentWindow().close();
    } catch (err) {
      console.error("Could not save AI settings:", err);
      setError("Could not save AI settings.");
      setSaving(false);
    }
  };

  const handleCancel = () => {
    getCurrentWindow().close();
  };

  if (!loaded) {
    return (
      <div className="app-page app-page--centered">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="chart-editor-page">
      <div className="chart-editor-header">
        <h3>AI Assistant Settings</h3>
        <div className="row-inline">
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="ai-settings-body">
        <label className="form-label" htmlFor="ai-provider">
          Provider
        </label>
        <select
          id="ai-provider"
          className="dashboard-switcher"
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>

        <label className="form-label" htmlFor="ai-model">
          Model
        </label>
        <input
          id="ai-model"
          className="panel-title-input"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />

        {provider === "openai" && (
          <>
            <label className="form-label" htmlFor="ai-base-url">
              Base URL (optional — for Azure OpenAI or a compatible endpoint)
            </label>
            <input
              id="ai-base-url"
              className="panel-title-input"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </>
        )}

        <label className="form-label" htmlFor="ai-api-key">
          API key
        </label>
        <input
          id="ai-api-key"
          type="password"
          className="panel-title-input"
          placeholder={hasKey ? "•••• (leave blank to keep the existing key)" : "sk-…"}
          value={apiKeyDraft}
          onChange={(e) => setApiKeyDraft(e.target.value)}
        />
        <p className="ai-settings-hint">
          Stored locally on this device in plain text (app data folder), never sent anywhere
          except directly to {provider === "openai" ? "OpenAI" : "Anthropic"} when you generate a
          chart. Transaction data is never sent — only field names and your prompt.
        </p>

        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
