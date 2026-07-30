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
import { zpayGwUiTheme } from "./theme/graphicWalkerTheme";

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
      <div className="chart-editor-body">
        <GraphicWalker
          storeRef={storeRef}
          chart={initialChart ? [initialChart as IChart] : undefined}
          data={state.data}
          fields={state.fields}
          appearance="dark"
          uiTheme={zpayGwUiTheme}
          hideChartNav
          keepAlive={false}
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
}
