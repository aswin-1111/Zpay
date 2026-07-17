import type { KpiPanelConfig } from "../../types/dashboard";
import { useDashboardData } from "../../context/DashboardDataContext";
import { KPI_METRIC_LABELS, getKpiValue } from "../../data/statement";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

const PLAIN_METRICS = new Set(["transactionCount"]);

export default function KpiPanel({ config }: { config: KpiPanelConfig }) {
  const { stats } = useDashboardData();
  const value = getKpiValue(stats, config.metric);
  const label = config.label ?? KPI_METRIC_LABELS[config.metric];
  const formatted = PLAIN_METRICS.has(config.metric)
    ? String(value)
    : currencyFormatter.format(value);

  return (
    <div className="kpi-panel">
      <div className="kpi-card-label">{label}</div>
      <div className="kpi-card-value kpi-panel-value">{formatted}</div>
    </div>
  );
}
