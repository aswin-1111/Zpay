import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import {
  useDashboardStore,
  useDashboardsForActiveStatement,
} from "./store/dashboardStore";
import { DashboardDataProvider } from "./context/DashboardDataContext";
import EmptyDashboardState from "./components/dashboard/EmptyDashboardState";
import DashboardToolbar from "./components/dashboard/DashboardToolbar";
import AccountSummary from "./components/dashboard/AccountSummary";
import DashboardGrid from "./components/dashboard/DashboardGrid";

type LoadState =
  | { status: "loading" }
  | { status: "no-statement" }
  | { status: "ready"; statementId: string; account: AccountDetails; transactions: Transaction[] };

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const dashboards = useDashboardsForActiveStatement();
  const load = useDashboardStore((s) => s.load);
  const selectStatement = useDashboardStore((s) => s.selectStatement);
  const dropDashboardsForStatement = useDashboardStore((s) => s.dropDashboardsForStatement);
  const updatePanelChart = useDashboardStore((s) => s.updatePanelChart);
  const activeDashboardId = useDashboardStore((s) => s.activeDashboardId);

  const loadStatement = useCallback(
    async (statementId: string) => {
      try {
        const statement = await loadStatementFromParquet(statementId);
        setState({
          status: "ready",
          statementId,
          account: statement.account,
          transactions: statement.transactions,
        });
        selectStatement(statementId);
      } catch (e) {
        console.error("Could not load that statement:", e);
        setState({ status: "no-statement" });
      }
    },
    [selectStatement]
  );

  useEffect(() => {
    async function init() {
      const appWindow = getCurrentWindow();
      try {
        await appWindow.maximize();
      } catch (e) {
        console.error("Failed to maximize:", e);
      }

      await load();

      const navigatedStatementId = (location.state as { statementId?: string } | null)
        ?.statementId;
      const statementId =
        navigatedStatementId ?? useDashboardStore.getState().activeStatementId;

      if (!statementId) {
        setState({ status: "no-statement" });
        return;
      }

      await loadStatement(statementId);
    }

    init();
    // Only run once on mount — switching statements afterwards goes through the
    // zpay://statement-selected listener below, not route re-navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fired by the Saved Statements window (a separate Tauri window) when the user
  // opens a different statement there.
  useEffect(() => {
    const unlisten = listen<{ statementId: string }>("zpay://statement-selected", (event) => {
      loadStatement(event.payload.statementId);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadStatement]);

  // Fired by the Saved Statements window when a statement is deleted there.
  useEffect(() => {
    const unlisten = listen<{ statementId: string }>("zpay://statement-deleted", (event) => {
      dropDashboardsForStatement(event.payload.statementId);
      setState((current) =>
        current.status === "ready" && current.statementId === event.payload.statementId
          ? { status: "no-statement" }
          : current
      );
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [dropDashboardsForStatement]);

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
          <aside className="dashboard-sidebar">
            <AccountSummary />
          </aside>
          <div className="dashboard-main">
            {dashboards.length > 0 ? (
              <>
                <DashboardToolbar />
                <DashboardGrid />
              </>
            ) : (
              <EmptyDashboardState />
            )}
          </div>
        </div>
      </DashboardDataProvider>
    </div>
  );
}
