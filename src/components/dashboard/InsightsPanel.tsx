import { useDashboardData } from "../../context/DashboardDataContext";
import { computeInsights } from "../../lib/insights";

export default function InsightsPanel() {
  const { data, stats } = useDashboardData();
  const insights = computeInsights(data, stats);

  if (insights.length === 0) {
    return <div className="panel-placeholder">Not enough transaction history yet for insights.</div>;
  }

  return (
    <div className="insights-panel">
      {insights.map((insight) => (
        <div key={insight.id} className={`insight-card insight-card--${insight.tone}`}>
          <div className="insight-card-title">{insight.title}</div>
          <div className="insight-card-detail">{insight.detail}</div>
        </div>
      ))}
    </div>
  );
}
