import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import type { IChart } from "@kanaries/graphic-walker";
import "./App.css";

import {
  loadStatementFromParquet,
  buildEnrichedDataset,
  computeSummaryStats,
} from "./data/statement";
import type { AccountDetails, Transaction } from "./parser";
import { useDashboardStore } from "./store/dashboardStore";
import { DashboardDataProvider } from "./context/DashboardDataContext";
import EmptyDashboardState from "./components/dashboard/EmptyDashboardState";
import DashboardToolbar from "./components/dashboard/DashboardToolbar";
import AccountSummary from "./components/dashboard/AccountSummary";
import DashboardGrid from "./components/dashboard/DashboardGrid";

type LoadState =
  | { status: "loading" }
  | { status: "no-statement" }
  | { status: "ready"; account: AccountDetails; transactions: Transaction[] };

export default function DashboardPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const dashboards = useDashboardStore((s) => s.dashboards);
  const load = useDashboardStore((s) => s.load);
  const updatePanelChart = useDashboardStore((s) => s.updatePanelChart);
  const activeDashboardId = useDashboardStore((s) => s.activeDashboardId);

  useEffect(() => {
    async function init() {
      const appWindow = getCurrentWindow();
      try {
        await appWindow.maximize();
      } catch (e) {
        console.error("Failed to maximize:", e);
      }

      try {
        const statement = await loadStatementFromParquet();
        setState({
          status: "ready",
          account: statement.account,
          transactions: statement.transactions,
        });
      } catch (e) {
        console.error("No statement available:", e);
        setState({ status: "no-statement" });
        return;
      }

      await load();
    }

    init();
  }, [load]);

  // The chart editor runs in its own Tauri window (so GraphicWalker gets full
  // screen space instead of being clipped inside a modal) and reports back here.
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

  if (state.status === "loading") {
    return (
      <div className="app-page app-page--centered">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (state.status === "no-statement") {
    return (
      <main className="app-page app-page--centered">
        <h1>No statement loaded</h1>
        <p>Upload a bank statement first to see a dashboard.</p>
        <button className="btn" onClick={() => navigate("/")}>
          Back to upload
        </button>
      </main>
    );
  }

  const { account, transactions } = state;
  const { data, fields } = buildEnrichedDataset(transactions);
  const stats = computeSummaryStats(account, transactions);

  return (
    <div className="app-shell">
      <DashboardDataProvider value={{ data, fields, account, stats }}>
        <div className="app-surface dashboard-surface">
          {dashboards.length > 0 ? (
            <>
              <AccountSummary />
              <DashboardToolbar />
              <DashboardGrid />
            </>
          ) : (
            <EmptyDashboardState />
          )}
        </div>
      </DashboardDataProvider>
    </div>
  );
}
