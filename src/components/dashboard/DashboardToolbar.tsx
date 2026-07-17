import { useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useDashboardStore, useActiveDashboard } from "../../store/dashboardStore";
import type { PanelKind } from "../../types/dashboard";

const DASHBOARD_FILTERS = [
  { name: "Zpay Dashboard", extensions: ["zpaydash", "json"] },
];

export default function DashboardToolbar() {
  const dashboard = useActiveDashboard();
  const dashboards = useDashboardStore((s) => s.dashboards);
  const editMode = useDashboardStore((s) => s.editMode);
  const setEditMode = useDashboardStore((s) => s.setEditMode);
  const renameDashboard = useDashboardStore((s) => s.renameDashboard);
  const selectDashboard = useDashboardStore((s) => s.selectDashboard);
  const deleteDashboard = useDashboardStore((s) => s.deleteDashboard);
  const addPanel = useDashboardStore((s) => s.addPanel);
  const createNew = useDashboardStore((s) => s.createNew);
  const importFromFile = useDashboardStore((s) => s.importFromFile);
  const buildExportFile = useDashboardStore((s) => s.buildExportFile);

  const [nameDraft, setNameDraft] = useState(dashboard?.name ?? "");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    setNameDraft(dashboard?.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard?.id]);

  if (!dashboard) return null;

  const handleAdd = (kind: PanelKind) => {
    addPanel(kind);
    setAddMenuOpen(false);
  };

  const handleExport = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const file = buildExportFile();
      if (!file) return;
      const path = await save({
        filters: DASHBOARD_FILTERS,
        defaultPath: `${dashboard.name}.zpaydash`,
      });
      if (!path) return;
      await invoke("export_dashboard_file", {
        path,
        contents: JSON.stringify(file, null, 2),
      });
    } catch (err) {
      console.error(err);
      setError("Could not export the dashboard.");
    } finally {
      busy.current = false;
    }
  };

  const handleImport = async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      const path = await open({ multiple: false, filters: DASHBOARD_FILTERS });
      if (!path || Array.isArray(path)) return;
      const contents = await invoke<string>("import_dashboard_file", { path });
      const result = importFromFile(contents);
      if (!result.ok) setError(result.error);
    } catch (err) {
      console.error(err);
      setError("Could not read that file.");
    } finally {
      busy.current = false;
    }
  };

  const handleDelete = () => {
    if (!confirm(`Delete "${dashboard.name}"? This can't be undone.`)) return;
    deleteDashboard(dashboard.id);
  };

  return (
    <div className="dashboard-toolbar">
      <div className="dashboard-toolbar-identity">
        <select
          className="dashboard-switcher"
          value={dashboard.id}
          onChange={(e) => selectDashboard(e.target.value)}
        >
          {dashboards.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <input
          className="dashboard-name-input"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            if (nameDraft.trim() && nameDraft !== dashboard.name) {
              renameDashboard(dashboard.id, nameDraft.trim());
            } else {
              setNameDraft(dashboard.name);
            }
          }}
        />
      </div>

      <div className="dashboard-toolbar-actions">
        {editMode && (
          <div className="dashboard-add-panel">
            <button className="btn" onClick={() => setAddMenuOpen((v) => !v)}>
              Add panel
            </button>
            {addMenuOpen && (
              <div className="dashboard-add-panel-menu">
                <button onClick={() => handleAdd("chart")}>Chart</button>
                <button onClick={() => handleAdd("kpi")}>KPI</button>
                <button onClick={() => handleAdd("text")}>Text</button>
              </div>
            )}
          </div>
        )}

        <button className="btn btn-secondary" onClick={() => setEditMode(!editMode)}>
          {editMode ? "Done editing" : "Edit dashboard"}
        </button>
        <button className="btn btn-secondary" onClick={handleImport}>
          Import
        </button>
        <button className="btn btn-secondary" onClick={handleExport}>
          Export
        </button>
        <button className="btn btn-secondary" onClick={() => createNew()}>
          New dashboard
        </button>
        <button className="btn btn-secondary btn-danger" onClick={handleDelete}>
          Delete
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
