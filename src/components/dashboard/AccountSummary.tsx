import { useState } from "react";
import { useDashboardData } from "../../context/DashboardDataContext";
import { KPI_METRIC_LABELS } from "../../data/statement";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AccountSummary() {
  const { account, stats } = useDashboardData();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="account-summary">
      <div className="account-summary-header">
        <div>
          <div className="account-summary-title">{account.accountName || "Account"}</div>
          <div className="account-summary-sub">
            {account.accountNumber} · {account.branch}
            {account.startDate || account.endDate
              ? ` · ${formatDate(account.startDate)} – ${formatDate(account.endDate)}`
              : ""}
          </div>
        </div>
        <button className="btn btn-icon" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "Show summary" : "Hide summary"}
        </button>
      </div>
      {!collapsed && (
        <div className="dashboard-kpi-row">
          <div className="kpi-card">
            <div className="kpi-card-label">{KPI_METRIC_LABELS.currentBalance}</div>
            <div className="kpi-card-value">{currencyFormatter.format(stats.currentBalance)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-label">{KPI_METRIC_LABELS.totalDebit}</div>
            <div className="kpi-card-value">{currencyFormatter.format(stats.totalDebit)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-label">{KPI_METRIC_LABELS.totalCredit}</div>
            <div className="kpi-card-value">{currencyFormatter.format(stats.totalCredit)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-label">{KPI_METRIC_LABELS.netFlow}</div>
            <div className="kpi-card-value">{currencyFormatter.format(stats.netFlow)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-label">{KPI_METRIC_LABELS.avgTransaction}</div>
            <div className="kpi-card-value">{currencyFormatter.format(stats.avgTransaction)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-label">Most active day</div>
            <div className="kpi-card-value">{stats.mostActiveWeekday ?? "—"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
