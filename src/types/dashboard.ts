import type { IChart } from "@kanaries/graphic-walker";

export const DASHBOARD_SCHEMA_VERSION = 2;

export type GridPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type KpiMetric =
  | "totalDebit"
  | "totalCredit"
  | "netFlow"
  | "avgTransaction"
  | "transactionCount"
  | "currentBalance";

export type ChartPanelConfig = {
  kind: "chart";
  chart: IChart | null;
};

export type KpiPanelConfig = {
  kind: "kpi";
  metric: KpiMetric;
  label?: string;
};

export type TextPanelConfig = {
  kind: "text";
  markdown: string;
};

export type PanelConfig = ChartPanelConfig | KpiPanelConfig | TextPanelConfig;

export type PanelKind = PanelConfig["kind"];

export type PanelSpec = {
  id: string;
  title: string;
  layout: GridPosition;
  config: PanelConfig;
};

export type DashboardSpec = {
  id: string;
  name: string;
  statementId: string;
  panels: PanelSpec[];
};

// Format for sharing/backing up a single dashboard (Export/Import buttons) —
// a template of chart configuration only, no transaction data.
export type DashboardFile = {
  version: number;
  createdAt: string;
  updatedAt: string;
  appVersion: string;
  dashboard: DashboardSpec;
};

// Format for the local autosave of every dashboard the user has (dashboards.json
// in AppData). Distinct from DashboardFile: this is never exported/shared.
export type DashboardCollectionFile = {
  version: number;
  updatedAt: string;
  appVersion: string;
  activeDashboardId: string | null;
  activeStatementId: string | null;
  dashboards: DashboardSpec[];
};

const APP_VERSION = "0.1.0";

export function createEmptyDashboard(
  statementId: string,
  name = "Untitled Dashboard"
): DashboardSpec {
  return {
    id: crypto.randomUUID(),
    name,
    statementId,
    panels: [],
  };
}

export function createDefaultPanelConfig(kind: PanelKind): PanelConfig {
  switch (kind) {
    case "chart":
      return { kind: "chart", chart: null };
    case "kpi":
      return { kind: "kpi", metric: "netFlow" };
    case "text":
      return { kind: "text", markdown: "" };
  }
}

export function createPanel(
  kind: PanelKind,
  layout: GridPosition,
  title?: string
): PanelSpec {
  return {
    id: crypto.randomUUID(),
    title: title ?? defaultTitleFor(kind),
    layout,
    config: createDefaultPanelConfig(kind),
  };
}

function defaultTitleFor(kind: PanelKind): string {
  switch (kind) {
    case "chart":
      return "New chart";
    case "kpi":
      return "New KPI";
    case "text":
      return "Note";
  }
}

export function buildDashboardFile(
  dashboard: DashboardSpec,
  existing?: Pick<DashboardFile, "createdAt">
): DashboardFile {
  const now = new Date().toISOString();
  return {
    version: DASHBOARD_SCHEMA_VERSION,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    appVersion: APP_VERSION,
    dashboard,
  };
}

export function buildDashboardCollectionFile(
  dashboards: DashboardSpec[],
  activeDashboardId: string | null,
  activeStatementId: string | null
): DashboardCollectionFile {
  return {
    version: DASHBOARD_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    activeDashboardId,
    activeStatementId,
    dashboards,
  };
}
