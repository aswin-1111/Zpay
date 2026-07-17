import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { IChart } from "@kanaries/graphic-walker";
import type { Layout } from "react-grid-layout";
import {
  buildDashboardCollectionFile,
  buildDashboardFile,
  createEmptyDashboard,
  createPanel,
  type DashboardSpec,
  type PanelConfig,
  type PanelKind,
} from "../types/dashboard";
import type { DashboardFile } from "../types/dashboard";
import { validateDashboardCollection, validateDashboardFile } from "../types/dashboardSchema";

const AUTOSAVE_DEBOUNCE_MS = 800;

const DEFAULT_SIZE: Record<PanelKind, { w: number; h: number }> = {
  chart: { w: 6, h: 8 },
  kpi: { w: 3, h: 3 },
  text: { w: 4, h: 4 },
};

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

type DashboardStore = {
  dashboards: DashboardSpec[];
  activeDashboardId: string | null;
  editMode: boolean;

  load: () => Promise<void>;
  createNew: (name?: string) => void;
  selectDashboard: (id: string) => void;
  deleteDashboard: (id: string) => void;
  renameDashboard: (id: string, name: string) => void;
  importFromFile: (contents: string) => { ok: true } | { ok: false; error: string };
  buildExportFile: () => DashboardFile | null;

  setEditMode: (editMode: boolean) => void;
  addPanel: (kind: PanelKind) => void;
  duplicatePanel: (id: string) => void;
  deletePanel: (id: string) => void;
  updatePanelTitle: (id: string, title: string) => void;
  updatePanelLayout: (layout: Layout) => void;
  updatePanelChart: (id: string, chart: IChart) => void;
  updatePanelConfig: (id: string, config: PanelConfig) => void;
};

function scheduleAutosave(get: () => DashboardStore) {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const { dashboards, activeDashboardId } = get();
    const file = buildDashboardCollectionFile(dashboards, activeDashboardId);
    invoke("save_dashboards", { contents: JSON.stringify(file) }).catch((err) => {
      console.error("Failed to autosave dashboards:", err);
    });
  }, AUTOSAVE_DEBOUNCE_MS);
}

function nextLayoutSlot(dashboard: DashboardSpec, w: number, h: number) {
  const maxY = dashboard.panels.reduce(
    (max, p) => Math.max(max, p.layout.y + p.layout.h),
    0
  );
  return { x: 0, y: maxY, w, h };
}

function updateActive(
  get: () => DashboardStore,
  set: (partial: Partial<DashboardStore>) => void,
  fn: (dashboard: DashboardSpec) => DashboardSpec
) {
  const { dashboards, activeDashboardId } = get();
  if (!activeDashboardId) return;
  set({
    dashboards: dashboards.map((d) => (d.id === activeDashboardId ? fn(d) : d)),
  });
  scheduleAutosave(get);
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  dashboards: [],
  activeDashboardId: null,
  editMode: false,

  load: async () => {
    const raw = await invoke<string | null>("load_dashboards");
    if (!raw) {
      set({ dashboards: [], activeDashboardId: null, editMode: false });
      return;
    }
    const result = validateDashboardCollection(JSON.parse(raw));
    if (!result.ok) {
      console.error("Stored dashboards failed validation:", result.error);
      set({ dashboards: [], activeDashboardId: null, editMode: false });
      return;
    }
    const { dashboards, activeDashboardId } = result.data;
    const validActiveId =
      activeDashboardId && dashboards.some((d) => d.id === activeDashboardId)
        ? activeDashboardId
        : (dashboards[0]?.id ?? null);
    set({ dashboards, activeDashboardId: validActiveId, editMode: false });
  },

  createNew: (name) => {
    const { dashboards } = get();
    const dashboard = createEmptyDashboard(name ?? `Dashboard ${dashboards.length + 1}`);
    set({
      dashboards: [...dashboards, dashboard],
      activeDashboardId: dashboard.id,
      editMode: true,
    });
    scheduleAutosave(get);
  },

  selectDashboard: (id) => {
    set({ activeDashboardId: id, editMode: false });
  },

  deleteDashboard: (id) => {
    const { dashboards, activeDashboardId } = get();
    const remaining = dashboards.filter((d) => d.id !== id);
    set({
      dashboards: remaining,
      activeDashboardId:
        activeDashboardId === id ? (remaining[0]?.id ?? null) : activeDashboardId,
    });
    scheduleAutosave(get);
  },

  renameDashboard: (id, name) => {
    const { dashboards } = get();
    set({
      dashboards: dashboards.map((d) => (d.id === id ? { ...d, name } : d)),
    });
    scheduleAutosave(get);
  },

  importFromFile: (contents) => {
    let json: unknown;
    try {
      json = JSON.parse(contents);
    } catch {
      return { ok: false, error: "Not valid JSON." };
    }
    const result = validateDashboardFile(json);
    if (!result.ok) return { ok: false, error: result.error };

    // Assign a fresh id in case this file was exported from this same app instance
    // and would otherwise collide with a dashboard already in the collection.
    const imported: DashboardSpec = { ...result.data.dashboard, id: crypto.randomUUID() };

    const { dashboards } = get();
    set({
      dashboards: [...dashboards, imported],
      activeDashboardId: imported.id,
      editMode: false,
    });
    scheduleAutosave(get);
    return { ok: true };
  },

  buildExportFile: () => {
    const { dashboards, activeDashboardId } = get();
    const active = dashboards.find((d) => d.id === activeDashboardId);
    if (!active) return null;
    return buildDashboardFile(active);
  },

  setEditMode: (editMode) => set({ editMode }),

  addPanel: (kind) => {
    updateActive(get, set, (dashboard) => {
      const { w, h } = DEFAULT_SIZE[kind];
      const layout = nextLayoutSlot(dashboard, w, h);
      const panel = createPanel(kind, layout);
      return { ...dashboard, panels: [...dashboard.panels, panel] };
    });
  },

  duplicatePanel: (id) => {
    updateActive(get, set, (dashboard) => {
      const source = dashboard.panels.find((p) => p.id === id);
      if (!source) return dashboard;
      const layout = nextLayoutSlot(dashboard, source.layout.w, source.layout.h);
      const copy = {
        ...source,
        id: crypto.randomUUID(),
        title: `${source.title} (copy)`,
        layout,
      };
      return { ...dashboard, panels: [...dashboard.panels, copy] };
    });
  },

  deletePanel: (id) => {
    updateActive(get, set, (dashboard) => ({
      ...dashboard,
      panels: dashboard.panels.filter((p) => p.id !== id),
    }));
  },

  updatePanelTitle: (id, title) => {
    updateActive(get, set, (dashboard) => ({
      ...dashboard,
      panels: dashboard.panels.map((p) => (p.id === id ? { ...p, title } : p)),
    }));
  },

  updatePanelLayout: (layout) => {
    updateActive(get, set, (dashboard) => {
      const byId = new Map(layout.map((item) => [item.i, item]));
      return {
        ...dashboard,
        panels: dashboard.panels.map((p) => {
          const item = byId.get(p.id);
          if (!item) return p;
          return {
            ...p,
            layout: { x: item.x, y: item.y, w: item.w, h: item.h },
          };
        }),
      };
    });
  },

  updatePanelChart: (id, chart) => {
    updateActive(get, set, (dashboard) => ({
      ...dashboard,
      panels: dashboard.panels.map((p) =>
        p.id === id && p.config.kind === "chart"
          ? { ...p, config: { kind: "chart", chart } }
          : p
      ),
    }));
  },

  updatePanelConfig: (id, config) => {
    updateActive(get, set, (dashboard) => ({
      ...dashboard,
      panels: dashboard.panels.map((p) => (p.id === id ? { ...p, config } : p)),
    }));
  },
}));

export function useActiveDashboard(): DashboardSpec | null {
  return useDashboardStore((s) => s.dashboards.find((d) => d.id === s.activeDashboardId) ?? null);
}
