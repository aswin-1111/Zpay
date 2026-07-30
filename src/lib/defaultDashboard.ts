import type { DashboardSpec, KpiMetric, PanelSpec } from "../types/dashboard";
import { KPI_METRIC_LABELS } from "../data/statement";
import { buildDefaultChart, dimensionField, measureField, COUNT_FIELD } from "./defaultCharts";

const KPI_ROW: KpiMetric[] = [
  "currentBalance",
  "totalCredit",
  "totalDebit",
  "netFlow",
  "avgTransaction",
  "transactionCount",
];

function kpiPanel(metric: KpiMetric, x: number): PanelSpec {
  return {
    id: crypto.randomUUID(),
    title: KPI_METRIC_LABELS[metric],
    layout: { x, y: 0, w: 2, h: 3 },
    config: { kind: "kpi", metric },
  };
}

function chartPanel(
  title: string,
  layout: PanelSpec["layout"],
  chart: ReturnType<typeof buildDefaultChart>
): PanelSpec {
  return {
    id: crypto.randomUUID(),
    title,
    layout,
    config: { kind: "chart", chart },
  };
}

export function buildDefaultDashboardPanels(): PanelSpec[] {
  const kpiPanels = KPI_ROW.map((metric, i) => kpiPanel(metric, i * 2));

  const balanceOverTime = chartPanel(
    "Balance over time",
    { x: 0, y: 3, w: 12, h: 8 },
    buildDefaultChart({
      visId: crypto.randomUUID(),
      name: "Balance over time",
      geoms: ["line"],
      columns: [dimensionField("txnDate", "Transaction date", "temporal")],
      rows: [measureField("balance", "Balance", "max")],
    })
  );

  const monthlyCreditDebit = chartPanel(
    "Monthly credit vs debit",
    { x: 0, y: 11, w: 6, h: 8 },
    buildDefaultChart({
      visId: crypto.randomUUID(),
      name: "Monthly credit vs debit",
      geoms: ["bar"],
      columns: [dimensionField("month", "Month")],
      rows: [measureField("absAmount", "Amount", "sum")],
      color: [dimensionField("type", "Type")],
    })
  );

  const debitCreditSplit = chartPanel(
    "Debit vs credit split",
    { x: 6, y: 11, w: 3, h: 8 },
    buildDefaultChart({
      visId: crypto.randomUUID(),
      name: "Debit vs credit split",
      geoms: ["arc"],
      theta: [measureField("absAmount", "Amount", "sum")],
      color: [dimensionField("type", "Type")],
    })
  );

  const weekdayActivity = chartPanel(
    "Activity by weekday",
    { x: 9, y: 11, w: 3, h: 8 },
    buildDefaultChart({
      visId: crypto.randomUUID(),
      name: "Activity by weekday",
      geoms: ["bar"],
      columns: [dimensionField("weekday", "Weekday")],
      rows: [COUNT_FIELD],
    })
  );

  return [
    ...kpiPanels,
    balanceOverTime,
    monthlyCreditDebit,
    debitCreditSplit,
    weekdayActivity,
  ];
}

export function createDefaultDashboard(statementId: string, name = "Overview"): DashboardSpec {
  return {
    id: crypto.randomUUID(),
    name,
    statementId,
    panels: buildDefaultDashboardPanels(),
  };
}
