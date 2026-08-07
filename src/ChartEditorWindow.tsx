import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import { GraphicWalker } from "@kanaries/graphic-walker";
import type { IChart, IMutField, VizSpecStore } from "@kanaries/graphic-walker";
import "./App.css";

import { loadStatementFromParquet, buildEnrichedDataset, type EnrichedRow } from "./data/statement";
import { validateDashboardCollection } from "./types/dashboardSchema";
import type { PanelSpec } from "./types/dashboard";
import type { AiSettingsPublic } from "./types/ai";
import { parseAiJsonResponse, validateAndBuildAiChart } from "./lib/aiChartSpec";
import { zpayGwUiTheme } from "./theme/graphicWalkerTheme";
import { useThemeStore } from "./store/themeStore";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; panel: PanelSpec; data: EnrichedRow[]; fields: IMutField[] };

export default function ChartEditorWindow() {
  const params = new URLSearchParams(window.location.search);
  const dashboardId = params.get("dashboardId") ?? "";
  const panelId = params.get("panelId") ?? "";

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const storeRef = useRef<VizSpecStore | null>(null);
  const theme = useThemeStore((s) => s.resolved);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    invoke<AiSettingsPublic | null>("load_ai_settings_public")
      .then((settings) => setAiConfigured(Boolean(settings?.hasKey)))
      .catch(() => setAiConfigured(false));
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const raw = await invoke<string | null>("load_dashboards");
        if (!raw) throw new Error("No dashboards have been saved yet.");
        const result = validateDashboardCollection(JSON.parse(raw));
        if (!result.ok) throw new Error(result.error);

        const dashboard = result.data.dashboards.find((d) => d.id === dashboardId);
        const panel = dashboard?.panels.find((p) => p.id === panelId);
        if (!dashboard || !panel) throw new Error("That panel no longer exists.");

        const statement = await loadStatementFromParquet(dashboard.statementId);
        const { data, fields } = buildEnrichedDataset(statement.transactions);
        setState({ status: "ready", panel, data, fields });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    init();
  }, [dashboardId, panelId]);

  const handleCancel = () => {
    getCurrentWindow().close();
  };

  const handleGenerate = async () => {
    if (state.status !== "ready" || !aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const fieldsPayload = state.fields.map((f) => ({
        fid: f.fid,
        name: f.name ?? f.fid,
        semanticType: f.semanticType,
      }));
      const raw = await invoke<string>("ask_ai_for_chart", {
        prompt: aiPrompt,
        fields: fieldsPayload,
      });
      const result = validateAndBuildAiChart(parseAiJsonResponse(raw), state.fields);
      if (!result.ok) {
        setAiError(result.error);
        return;
      }
      storeRef.current?.importCode([result.chart]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiBusy(false);
    }
  };

  const handleSave = async () => {
    const charts = storeRef.current?.exportCode();
    const chart = charts?.[0];
    if (chart) {
      await emit("zpay://chart-saved", { dashboardId, panelId, chart });
    }
    getCurrentWindow().close();
  };

  if (state.status === "loading") {
    return (
      <div className="app-page app-page--centered">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <main className="app-page app-page--centered">
        <h1>Can't open this chart</h1>
        <p>{state.message}</p>
        <button className="btn" onClick={handleCancel}>
          Close
        </button>
      </main>
    );
  }

  const initialChart = state.panel.config.kind === "chart" ? state.panel.config.chart : null;

  return (
    <div className="chart-editor-page">
      <div className="chart-editor-header">
        <h3>{state.panel.title}</h3>
        <div className="row-inline">
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
      {aiConfigured === true && (
        <div className="ai-prompt-bar">
          <input
            className="ai-prompt-input"
            placeholder="Describe a chart, e.g. “monthly spend by category”"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleGenerate();
            }}
            disabled={aiBusy}
          />
          <button
            className="btn btn-secondary"
            disabled={aiBusy || !aiPrompt.trim()}
            onClick={handleGenerate}
          >
            {aiBusy ? "Generating…" : "✨ Generate"}
          </button>
        </div>
      )}
      {aiConfigured === false && (
        <div className="ai-prompt-bar ai-prompt-bar--disabled">
          Configure an API key via the app menu → AI Assistant → Configure API Key… to generate
          charts from a description.
        </div>
      )}
      {aiError && <p className="form-error ai-prompt-error">{aiError}</p>}
      <div className="chart-editor-body">
        <GraphicWalker
          storeRef={storeRef}
          chart={initialChart ? [initialChart as IChart] : undefined}
          data={state.data}
          fields={state.fields}
          appearance={theme}
          uiTheme={zpayGwUiTheme}
          hideChartNav
          keepAlive={false}
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
}
