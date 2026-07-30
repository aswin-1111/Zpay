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

  if (collapsed) {
    return (
      <div className="account-summary account-summary--collapsed">
        <button
          className="btn btn-icon account-summary-expand"
          onClick={() => setCollapsed(false)}
          title="Show account summary"
        >
          »
        </button>
      </div>
    );
  }

  return (
    <div className="account-summary">
      <div className="account-summary-header">
        <div className="account-summary-heading">
          <div className="account-summary-title">{account.accountName || "Account"}</div>
          <div className="account-summary-sub">{account.accountNumber}</div>
          <div className="account-summary-sub">{account.branch}</div>
          {(account.startDate || account.endDate) && (
            <div className="account-summary-sub">
              {formatDate(account.startDate)} – {formatDate(account.endDate)}
            </div>
          )}
        </div>
        <button className="btn btn-icon" onClick={() => setCollapsed(true)} title="Collapse">
          «
        </button>
      </div>
      <div className="dashboard-kpi-column">
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
    </div>
  );
}
