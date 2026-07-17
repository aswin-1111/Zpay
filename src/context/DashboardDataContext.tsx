import { createContext, useContext } from "react";
import type { IMutField } from "@kanaries/graphic-walker";
import type { AccountDetails } from "../parser";
import type { EnrichedRow, SummaryStats } from "../data/statement";

export type DashboardData = {
  data: EnrichedRow[];
  fields: IMutField[];
  account: AccountDetails;
  stats: SummaryStats;
};

const DashboardDataContext = createContext<DashboardData | null>(null);

export function DashboardDataProvider({
  value,
  children,
}: {
  value: DashboardData;
  children: React.ReactNode;
}) {
  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error("useDashboardData must be used within DashboardDataProvider");
  }
  return ctx;
}
