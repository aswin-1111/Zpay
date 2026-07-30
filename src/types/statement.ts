export type StatementSummary = {
  id: string;
  originalFileName: string;
  savedAt: string;
  accountName: string;
  accountNumberMasked: string;
  branch: string;
  startDate: string | null;
  endDate: string | null;
  transactionCount: number;
};
