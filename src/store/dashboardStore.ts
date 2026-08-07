import { useMemo } from "react";
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import type { IChart } from "@kanaries/graphic-walker";
import type { Layout } from "react-grid-layout";
import {
  buildDashboardCollectionFile,
  buildDashboardFile,
  buildDefaultDashboardTemplateFile,
  createEmptyDashboard,
  createPanel,
  type DashboardSpec,
  type PanelConfig,
  type PanelKind,
  type PanelSpec,
} from "../types/dashboard";
import type { DashboardFile } from "../types/dashboard";
import {
  validateDashboardCollection,
  validateDashboardFile,
  validateDefaultDashboardTemplate,
} from "../types/dashboardSchema";
import { createDefaultDashboard } from "../lib/defaultDashboard";

const AUTOSAVE_DEBOUNCE_MS = 800;

const DEFAULT_SIZE: Record<PanelKind, { w: number; h: number }> = {
  chart: { w: 6, h: 8 },
  kpi: { w: 3, h: 3 },
  text: { w: 4, h: 4 },
  insight: { w: 12, h: 6 },
};

export const MIN_SIZE: Record<PanelKind, { minW: number; minH: number }> = {
  chart: { minW: 3, minH: 4 },
  kpi: { minW: 2, minH: 3 },
  text: { minW: 2, minH: 2 },
  insight: { minW: 4, minH: 3 },
};

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

type DashboardStore = {
  dashboards: DashboardSpec[];
  activeDashboardId: string | null;
  activeStatementId: string | null;
  editMode: boolean;
  defaultTemplate: PanelSpec[] | null;
  autosaveEnabled: boolean;

  load: () => Promise<void>;
  loadDefaultTemplate: () => Promise<void>;
  saveDefaultTemplate: (panels: PanelSpec[]) => Promise<void>;
  selectStatement: (statementId: string) => void;
  dropDashboardsForStatement: (statementId: string) => void;
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
  // The default-dashboard-template editor window reuses this same store module
  // (loaded fresh in its own webview) to get panel add/duplicate/delete/edit for
  // free, but it seeds a synthetic dashboard that must never be written into the
  // real dashboards.json — doing so would overwrite every real saved dashboard
  // with just that one fake entry. That window disables autosave on init.
  if (!get().autosaveEnabled) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const { dashboards, activeDashboardId, activeStatementId } = get();
    const file = buildDashboardCollectionFile(dashboards, activeDashboardId, activeStatementId);
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
  activeStatementId: null,
  editMode: false,
  defaultTemplate: null,
  autosaveEnabled: true,

  load: async () => {
    const raw = await invoke<string | null>("load_dashboards");
    if (!raw) {
      set({ dashboards: [], activeDashboardId: null, activeStatementId: null, editMode: false });
      return;
    }
    const result = validateDashboardCollection(JSON.parse(raw));
    if (!result.ok) {
      console.error("Stored dashboards failed validation:", result.error);
      set({ dashboards: [], activeDashboardId: null, activeStatementId: null, editMode: false });
      return;
    }
    const { dashboards, activeDashboardId, activeStatementId } = result.data;
    const validActiveId =
      activeDashboardId && dashboards.some((d) => d.id === activeDashboardId)
        ? activeDashboardId
        : (dashboards[0]?.id ?? null);
    set({ dashboards, activeDashboardId: validActiveId, activeStatementId, editMode: false });
  },

  // The user-customized template new statements' default dashboards are seeded
  // from (see the "Edit Default Dashboard…" app-menu window). Falls back to the
  // built-in template in defaultDashboard.ts when nothing has been saved yet.
  loadDefaultTemplate: async () => {
    const raw = await invoke<string | null>("load_default_dashboard_template");
    if (!raw) {
      set({ defaultTemplate: null });
      return;
    }
    const result = validateDefaultDashboardTemplate(JSON.parse(raw));
    if (!result.ok) {
      console.error("Stored default-dashboard template failed validation:", result.error);
      set({ defaultTemplate: null });
      return;
    }
    set({ defaultTemplate: result.data.panels });
  },

  saveDefaultTemplate: async (panels) => {
    const file = buildDefaultDashboardTemplateFile(panels);
    await invoke("save_default_dashboard_template", { contents: JSON.stringify(file) });
    set({ defaultTemplate: panels });
    emit("zpay://default-template-updated");
  },

  // Switches to the given statement. If it has no dashboards yet, a populated
  // default one is created for it immediately (rather than showing an empty grid).
  selectStatement: (statementId) => {
    const { dashboards, defaultTemplate } = get();
    const existing = dashboards.filter((d) => d.statementId === statementId);
    if (existing.length > 0) {
      set({ activeStatementId: statementId, activeDashboardId: existing[0].id, editMode: false });
      return;
    }
    const dashboard = createDefaultDashboard(statementId, defaultTemplate ?? undefined);
    set({
      dashboards: [...dashboards, dashboard],
      activeStatementId: statementId,
      activeDashboardId: dashboard.id,
      editMode: false,
    });
    scheduleAutosave(get);
  },

  dropDashboardsForStatement: (statementId) => {
    const { dashboards, activeDashboardId, activeStatementId } = get();
    const remaining = dashboards.filter((d) => d.statementId !== statementId);
    const stillHasActiveDashboard = remaining.some((d) => d.id === activeDashboardId);
    set({
      dashboards: remaining,
      activeDashboardId: stillHasActiveDashboard ? activeDashboardId : (remaining[0]?.id ?? null),
      activeStatementId: activeStatementId === statementId ? null : activeStatementId,
    });
    scheduleAutosave(get);
  },

  createNew: (name) => {
    const { dashboards, activeStatementId } = get();
    if (!activeStatementId) return;
    const count = dashboards.filter((d) => d.statementId === activeStatementId).length;
    const dashboard = createEmptyDashboard(activeStatementId, name ?? `Dashboard ${count + 1}`);
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
    const { dashboards, activeDashboardId, activeStatementId } = get();
    const target = dashboards.find((d) => d.id === id);
    const remaining = dashboards.filter((d) => d.id !== id);
    const siblingId =
      target != null
        ? remaining.find((d) => d.statementId === target.statementId)?.id ?? null
        : null;
    set({
      dashboards: remaining,
      activeStatementId,
      activeDashboardId: activeDashboardId === id ? siblingId : activeDashboardId,
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
    const { activeStatementId } = get();
    if (!activeStatementId) return { ok: false, error: "No statement is currently open." };

    let json: unknown;
    try {
      json = JSON.parse(contents);
    } catch {
      return { ok: false, error: "Not valid JSON." };
    }
    const result = validateDashboardFile(json);
    if (!result.ok) return { ok: false, error: result.error };

    // Assign a fresh id (in case this file was exported from this same app instance)
    // and re-tag it to whichever statement is currently open — the statement id it
    // was originally exported with may not exist in this install.
    const imported: DashboardSpec = {
      ...result.data.dashboard,
      id: crypto.randomUUID(),
      statementId: activeStatementId,
    };

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

const EMPTY_DASHBOARDS: DashboardSpec[] = [];

export function useDashboardsForActiveStatement(): DashboardSpec[] {
  // `.filter()` builds a new array on every call; selecting the raw state and
  // memoizing here (rather than filtering inside the zustand selector) keeps the
  // returned reference stable across renders when nothing actually changed —
  // otherwise useSyncExternalStore sees a "new" snapshot every render and spins
  // into an infinite update loop.
  const dashboards = useDashboardStore((s) => s.dashboards);
  const activeStatementId = useDashboardStore((s) => s.activeStatementId);
  return useMemo(
    () =>
      activeStatementId
        ? dashboards.filter((d) => d.statementId === activeStatementId)
        : EMPTY_DASHBOARDS,
    [dashboards, activeStatementId]
  );
}
