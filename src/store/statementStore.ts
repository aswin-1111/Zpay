import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { StatementSummary } from "../types/statement";

type StatementStore = {
  statements: StatementSummary[];
  loaded: boolean;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useStatementStore = create<StatementStore>((set, get) => ({
  statements: [],
  loaded: false,

  load: async () => {
    const statements = await invoke<StatementSummary[]>("list_statements");
    set({ statements, loaded: true });
  },

  refresh: async () => {
    await get().load();
  },

  remove: async (id) => {
    await invoke("delete_statement", { id });
    await get().load();
  },
}));
