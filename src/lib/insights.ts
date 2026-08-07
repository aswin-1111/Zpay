import type { EnrichedRow, SummaryStats } from "../data/statement";

export type Insight = {
  id: string;
  title: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
};

const currencyFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

// Magnitude-only formatting (callers that already know the sign phrase it in words).
function fmt(n: number): string {
  return `₹${currencyFormatter.format(Math.abs(n))}`;
}

// Signed formatting for values that can legitimately be negative (net flow).
function fmtSigned(n: number): string {
  return n < 0 ? `-₹${currencyFormatter.format(-n)}` : `₹${currencyFormatter.format(n)}`;
}

function monthlyDebitTotals(data: EnrichedRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of data) {
    if (row.type !== "Debit" || !row.month) continue;
    totals.set(row.month, (totals.get(row.month) ?? 0) + row.absAmount);
  }
  return totals;
}

function spendVsAverageInsight(data: EnrichedRow[]): Insight | null {
  const totals = monthlyDebitTotals(data);
  const months = [...totals.keys()].sort();
  if (months.length < 2) return null;

  const latestMonth = months[months.length - 1];
  const latestTotal = totals.get(latestMonth) ?? 0;
  const priorMonths = months.slice(0, -1);
  const priorAvg =
    priorMonths.reduce((sum, m) => sum + (totals.get(m) ?? 0), 0) / priorMonths.length;
  if (priorAvg <= 0) return null;

  const deltaPct = ((latestTotal - priorAvg) / priorAvg) * 100;
  if (Math.abs(deltaPct) < 15) return null;
  const up = deltaPct > 0;

  return {
    id: "spend-vs-average",
    title: up ? "Spending is up" : "Spending is down",
    detail: `${latestMonth} spend was ${fmt(latestTotal)}, ${Math.abs(deltaPct).toFixed(0)}% ${
      up ? "above" : "below"
    } your ${priorMonths.length}-month average of ${fmt(priorAvg)}.`,
    tone: up ? "negative" : "positive",
  };
}

function outlierTransactionInsight(data: EnrichedRow[]): Insight | null {
  if (data.length < 5) return null;
  const amounts = data.map((r) => r.absAmount);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return null;

  let outlier: EnrichedRow | null = null;
  let bestZ = 2; // threshold: only flag transactions > 2 standard deviations out
  for (const row of data) {
    const z = (row.absAmount - mean) / stddev;
    if (z > bestZ) {
      bestZ = z;
      outlier = row;
    }
  }
  if (!outlier) return null;

  return {
    id: "outlier-transaction",
    title: "Unusually large transaction",
    detail: `${outlier.type === "Debit" ? "A payment of" : "A credit of"} ${fmt(outlier.absAmount)} (${
      outlier.description.trim() || "no description"
    }${outlier.txnDate ? ` on ${outlier.txnDate}` : ""}) stands out from your typical transaction size.`,
    tone: "neutral",
  };
}

function busiestWeekdayInsight(data: EnrichedRow[], stats: SummaryStats): Insight | null {
  if (!stats.mostActiveWeekday || data.length < 7) return null;

  const counts = new Map<string, number>();
  for (const row of data) {
    if (!row.weekday) continue;
    counts.set(row.weekday, (counts.get(row.weekday) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const daysUsed = counts.size || 1;
  const avg = total / daysUsed;
  const top = counts.get(stats.mostActiveWeekday) ?? 0;
  if (avg <= 0 || top < avg * 1.3) return null;

  return {
    id: "busiest-weekday",
    title: `${stats.mostActiveWeekday}s are your busiest day`,
    detail: `${top} transactions happened on a ${stats.mostActiveWeekday}, well above your ${avg.toFixed(
      1
    )}-per-day average.`,
    tone: "neutral",
  };
}

function topSpendingSourceInsight(data: EnrichedRow[], stats: SummaryStats): Insight | null {
  if (stats.totalDebit <= 0) return null;

  const totals = new Map<string, number>();
  for (const row of data) {
    if (row.type !== "Debit") continue;
    const key = row.description.trim() || "Unlabeled";
    totals.set(key, (totals.get(key) ?? 0) + row.absAmount);
  }
  if (totals.size === 0) return null;

  let topKey = "";
  let topAmount = 0;
  for (const [key, amount] of totals) {
    if (amount > topAmount) {
      topAmount = amount;
      topKey = key;
    }
  }
  const share = (topAmount / stats.totalDebit) * 100;
  if (share < 15) return null;

  return {
    id: "top-spending-source",
    title: "Top spending source",
    detail: `"${topKey}" accounts for ${fmt(topAmount)} — ${share.toFixed(0)}% of your total spending.`,
    tone: "neutral",
  };
}

function netFlowTrendInsight(data: EnrichedRow[]): Insight | null {
  const byMonth = new Map<string, number>();
  for (const row of data) {
    if (!row.month) continue;
    const delta = row.type === "Credit" ? row.absAmount : -row.absAmount;
    byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + delta);
  }
  const months = [...byMonth.keys()].sort();
  if (months.length < 2) return null;

  const latest = byMonth.get(months[months.length - 1]) ?? 0;
  const previous = byMonth.get(months[months.length - 2]) ?? 0;
  const delta = latest - previous;
  if (Math.abs(delta) < 1) return null;
  const up = delta > 0;

  return {
    id: "net-flow-trend",
    title: up ? "Net cash flow improved" : "Net cash flow declined",
    detail: `Net flow went from ${fmtSigned(previous)} to ${fmtSigned(latest)} month over month, a ${
      up ? "gain" : "drop"
    } of ${fmt(delta)}.`,
    tone: up ? "positive" : "negative",
  };
}

// Pure, deterministic, client-side-only — no LLM involved. Each check either
// finds something worth surfacing or returns null; we show up to 4 of whatever
// fires. See scratch/ai-integration-research.md's recommendation #2.
export function computeInsights(data: EnrichedRow[], stats: SummaryStats): Insight[] {
  const candidates = [
    spendVsAverageInsight(data),
    outlierTransactionInsight(data),
    busiestWeekdayInsight(data, stats),
    topSpendingSourceInsight(data, stats),
    netFlowTrendInsight(data),
  ].filter((insight): insight is Insight => insight !== null);

  return candidates.slice(0, 4);
}
