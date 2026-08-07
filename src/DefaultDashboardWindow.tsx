import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { IChart } from "@kanaries/graphic-walker";
import "./App.css";

import type { AccountDetails, Transaction } from "./parser";
import type { PanelKind } from "./types/dashboard";
import {
  useDashboardStore,
  useActiveDashboard,
} from "./store/dashboardStore";
import {
  loadStatementFromParquet,
  buildEnrichedDataset,
  computeSummaryStats,
} from "./data/statement";
import type { StatementSummary } from "./types/statement";
import { DashboardDataProvider } from "./context/DashboardDataContext";
import { buildDefaultDashboardPanels, cloneTemplatePanels } from "./lib/defaultDashboard";
import DashboardGrid from "./components/dashboard/DashboardGrid";

// This window edits a synthetic "template" dashboard, not a real one tied to any
// saved statement — see the autosaveEnabled guard in dashboardStore.ts for why
// that distinction matters.
const TEMPLATE_DASHBOARD_ID = "template";
const TEMPLATE_STATEMENT_ID = "__template__";

const EMPTY_ACCOUNT: AccountDetails = {
  accountName: "",
  address: "",
  statementDate: null,
  accountNumber: "",
  accountDescription: "",
  branch: "",
  drawingPower: 0,
  interestRate: 0,
  modBalance: 0,
  cif: "",
  ifsc: "",
  micr: "",
  nomination: "",
  openingBalance: 0,
  startDate: null,
  endDate: null,
};

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; account: AccountDetails; transactions: Transaction[] }
  | { status: "empty" };

export default function DefaultDashboardWindow() {
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  const [ready, setReady] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const dashboards = useDashboardStore((s) => s.dashboards);
  const activeDashboardId = useDashboardStore((s) => s.activeDashboardId);
  const addPanel = useDashboardStore((s) => s.addPanel);
  const updatePanelChart = useDashboardStore((s) => s.updatePanelChart);
  const saveDefaultTemplate = useDashboardStore((s) => s.saveDefaultTemplate);
  const loadDefaultTemplate = useDashboardStore((s) => s.loadDefaultTemplate);
  const dashboard = useActiveDashboard();

  useEffect(() => {
    async function init() {
      // Autosave must be off before any store action can fire — see the guard
      // comment in dashboardStore.ts's scheduleAutosave.
      useDashboardStore.setState({ autosaveEnabled: false });

      await loadDefaultTemplate();
      const template = useDashboardStore.getState().defaultTemplate;
      useDashboardStore.setState({
        dashboards: [
          {
            id: TEMPLATE_DASHBOARD_ID,
            name: "Default Dashboard Template",
            statementId: TEMPLATE_STATEMENT_ID,
            panels: template ? cloneTemplatePanels(template) : buildDefaultDashboardPanels(),
          },
        ],
        activeDashboardId: TEMPLATE_DASHBOARD_ID,
        activeStatementId: TEMPLATE_STATEMENT_ID,
        editMode: true,
      });
      setReady(true);

      try {
        const statements = await invoke<StatementSummary[]>("list_statements");
        if (statements.length === 0) {
          setPreview({ status: "empty" });
          return;
        }
        const statement = await loadStatementFromParquet(statements[0].id);
        setPreview({ status: "ready", account: statement.account, transactions: statement.transactions });
      } catch (err) {
        console.error("Could not load a statement to preview charts against:", err);
        setPreview({ status: "empty" });
      }
    }

    init();
  }, [loadDefaultTemplate]);

  // The per-panel chart editor runs in its own window and reports back here.
  useEffect(() => {
    const unlisten = listen<{ dashboardId: string; panelId: string; chart: IChart }>(
      "zpay://chart-saved",
      (event) => {
        const { dashboardId, panelId, chart } = event.payload;
        if (dashboardId === activeDashboardId) {
          updatePanelChart(panelId, chart);
        }
      }
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [activeDashboardId, updatePanelChart]);

  const handleAdd = (kind: PanelKind) => {
    addPanel(kind);
    setAddMenuOpen(false);
  };

  const handleReset = () => {
    if (
      !confirm(
        "Reset to the built-in default dashboard? This discards your customizations here (they aren't lost from disk until you click Save)."
      )
    ) {
      return;
    }
    useDashboardStore.setState((s) => ({
      dashboards: s.dashboards.map((d) =>
        d.id === TEMPLATE_DASHBOARD_ID ? { ...d, panels: buildDefaultDashboardPanels() } : d
      ),
    }));
  };

  const handleSave = async () => {
    if (!dashboard) return;
    setSaveState("saving");
    try {
      await saveDefaultTemplate(dashboard.panels);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (err) {
      console.error("Failed to save the default dashboard template:", err);
      alert("Could not save the default dashboard template.");
      setSaveState("idle");
    }
  };

  if (!ready || preview.status === "loading" || dashboards.length === 0) {
    return (
      <div className="app-page app-page--centered">
        <div className="loading-spinner" />
      </div>
    );
  }

  const account = preview.status === "ready" ? preview.account : EMPTY_ACCOUNT;
  const transactions = preview.status === "ready" ? preview.transactions : [];
  const { data, fields } = buildEnrichedDataset(transactions);
  const stats = computeSummaryStats(account, transactions);

  return (
    <div className="chart-editor-page">
      <div className="chart-editor-header">
        <h3>Edit Default Dashboard</h3>
        <div className="row-inline">
          {preview.status === "empty" && (
            <span className="loading-filename" style={{ margin: 0 }}>
              No saved statements — previews use blank data
            </span>
          )}
          <div className="dashboard-add-panel">
            <button className="btn btn-secondary" onClick={() => setAddMenuOpen((v) => !v)}>
              Add panel
            </button>
            {addMenuOpen && (
              <div className="dashboard-add-panel-menu">
                <button onClick={() => handleAdd("chart")}>Chart</button>
                <button onClick={() => handleAdd("kpi")}>KPI</button>
                <button onClick={() => handleAdd("text")}>Text</button>
                <button onClick={() => handleAdd("insight")}>Insights</button>
              </div>
            )}
          </div>
          <button className="btn btn-secondary" onClick={handleReset}>
            Reset to built-in
          </button>
          <button className="btn" disabled={saveState === "saving"} onClick={handleSave}>
            {saveState === "saved" ? "Saved" : "Save as default"}
          </button>
        </div>
      </div>
      <div className="chart-editor-body">
        <DashboardDataProvider value={{ data, fields, account, stats }}>
          <DashboardGrid />
        </DashboardDataProvider>
      </div>
    </div>
  );
}
