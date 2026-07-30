import { invoke } from "@tauri-apps/api/core";
import type { IMutField } from "@kanaries/graphic-walker";
import type { AccountDetails, Transaction } from "../parser";
import type { KpiMetric } from "../types/dashboard";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type RawAccountDetails = Omit<
  AccountDetails,
  "statementDate" | "startDate" | "endDate"
> & {
  statementDate: string | null;
  startDate: string | null;
  endDate: string | null;
};

type RawTransaction = Omit<Transaction, "txnDate" | "valueDate"> & {
  txnDate: string | null;
  valueDate: string | null;
};

type RawStatement = {
  account: RawAccountDetails;
  transactions: RawTransaction[];
};

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function loadStatementFromParquet(statementId: string): Promise<{
  account: AccountDetails;
  transactions: Transaction[];
}> {
  const raw = await invoke<RawStatement>("load_statement", { id: statementId });

  const account: AccountDetails = {
    ...raw.account,
    statementDate: parseIsoDate(raw.account.statementDate),
    startDate: parseIsoDate(raw.account.startDate),
    endDate: parseIsoDate(raw.account.endDate),
  };

  const transactions: Transaction[] = raw.transactions
    .map((t) => ({
      ...t,
      txnDate: parseIsoDate(t.txnDate),
      valueDate: parseIsoDate(t.valueDate),
    }))
    .filter((t) => !isBlankRow(t));

  return { account, transactions };
}

// The source statement sheet has trailing footer rows (signature lines, etc.) that
// parse as an all-empty transaction — no date, no description/reference, zero amounts.
// Drop them here so they don't skew KPI totals or show up as phantom chart points.
function isBlankRow(t: Transaction): boolean {
  return (
    t.txnDate === null &&
    t.description.trim() === "" &&
    t.reference.trim() === "" &&
    t.debit === 0 &&
    t.credit === 0 &&
    t.balance === 0
  );
}

export type EnrichedRow = {
  txnDate: string | null;
  valueDate: string | null;
  year: number | null;
  month: string | null;
  weekday: string | null;
  description: string;
  reference: string;
  type: "Debit" | "Credit";
  debit: number;
  credit: number;
  balance: number;
  amount: number;
  absAmount: number;
};

function formatDateKey(date: Date | null): string | null {
  if (!date) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildEnrichedDataset(transactions: Transaction[]): {
  data: EnrichedRow[];
  fields: IMutField[];
} {
  const data: EnrichedRow[] = transactions.map((t) => {
    const date = t.txnDate;
    const amount = t.credit - t.debit;
    return {
      txnDate: formatDateKey(date),
      valueDate: formatDateKey(t.valueDate),
      year: date ? date.getUTCFullYear() : null,
      month: date
        ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
        : null,
      weekday: date ? WEEKDAYS[date.getUTCDay()] : null,
      description: t.description,
      reference: t.reference,
      type: t.credit > 0 ? "Credit" : "Debit",
      debit: t.debit,
      credit: t.credit,
      balance: t.balance,
      amount,
      absAmount: Math.abs(amount),
    };
  });

  const fields: IMutField[] = [
    { fid: "txnDate", name: "Transaction date", analyticType: "dimension", semanticType: "temporal" },
    { fid: "valueDate", name: "Value date", analyticType: "dimension", semanticType: "temporal" },
    { fid: "year", name: "Year", analyticType: "dimension", semanticType: "ordinal" },
    { fid: "month", name: "Month", analyticType: "dimension", semanticType: "nominal" },
    { fid: "weekday", name: "Weekday", analyticType: "dimension", semanticType: "nominal" },
    { fid: "description", name: "Description", analyticType: "dimension", semanticType: "nominal" },
    { fid: "reference", name: "Reference", analyticType: "dimension", semanticType: "nominal" },
    { fid: "type", name: "Type", analyticType: "dimension", semanticType: "nominal" },
    { fid: "debit", name: "Debit", analyticType: "measure", semanticType: "quantitative" },
    { fid: "credit", name: "Credit", analyticType: "measure", semanticType: "quantitative" },
    { fid: "balance", name: "Balance", analyticType: "measure", semanticType: "quantitative" },
    { fid: "amount", name: "Net amount", analyticType: "measure", semanticType: "quantitative" },
    { fid: "absAmount", name: "Amount (abs)", analyticType: "measure", semanticType: "quantitative" },
  ];

  return { data, fields };
}

export type SummaryStats = {
  totalDebit: number;
  totalCredit: number;
  netFlow: number;
  avgTransaction: number;
  transactionCount: number;
  mostActiveWeekday: string | null;
  currentBalance: number;
};

export function computeSummaryStats(
  account: AccountDetails,
  transactions: Transaction[]
): SummaryStats {
  let totalDebit = 0;
  let totalCredit = 0;
  const weekdayCounts = new Map<string, number>();

  for (const t of transactions) {
    totalDebit += t.debit;
    totalCredit += t.credit;
    if (t.txnDate) {
      const weekday = WEEKDAYS[t.txnDate.getUTCDay()];
      weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
    }
  }

  let mostActiveWeekday: string | null = null;
  let mostActiveCount = 0;
  for (const [day, count] of weekdayCounts) {
    if (count > mostActiveCount) {
      mostActiveCount = count;
      mostActiveWeekday = day;
    }
  }

  const transactionCount = transactions.length;
  const netFlow = totalCredit - totalDebit;
  const avgTransaction =
    transactionCount > 0 ? (totalDebit + totalCredit) / transactionCount : 0;
  const currentBalance =
    transactionCount > 0
      ? transactions[transactionCount - 1].balance
      : account.openingBalance;

  return {
    totalDebit,
    totalCredit,
    netFlow,
    avgTransaction,
    transactionCount,
    mostActiveWeekday,
    currentBalance,
  };
}

export const KPI_METRIC_LABELS: Record<KpiMetric, string> = {
  totalDebit: "Total debits",
  totalCredit: "Total credits",
  netFlow: "Net cash flow",
  avgTransaction: "Average transaction",
  transactionCount: "Transaction count",
  currentBalance: "Current balance",
};

export function getKpiValue(stats: SummaryStats, metric: KpiMetric): number {
  return stats[metric];
}
