import { useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useDashboardStore } from "../../store/dashboardStore";

const DASHBOARD_FILTERS = [
  { name: "Zpay Dashboard", extensions: ["zpaydash", "json"] },
];

export default function EmptyDashboardState() {
  const createNew = useDashboardStore((s) => s.createNew);
  const importFromFile = useDashboardStore((s) => s.importFromFile);
  const selectStatement = useDashboardStore((s) => s.selectStatement);
  const activeStatementId = useDashboardStore((s) => s.activeStatementId);
  const [error, setError] = useState<string | null>(null);
  const importing = useRef(false);

  const handleCreateDefault = () => {
    if (activeStatementId) selectStatement(activeStatementId);
  };

  const handleImport = async () => {
    if (importing.current) return;
    importing.current = true;
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
      importing.current = false;
    }
  };

  return (
    <div className="empty-dashboard-state">
      <h2>No dashboard yet</h2>
      <p>Create a new dashboard for this statement, or import one you saved earlier.</p>
      <div className="row-inline">
        <button className="btn" onClick={handleCreateDefault}>
          Create default dashboard
        </button>
        <button className="btn btn-secondary" onClick={() => createNew()}>
          Create blank dashboard
        </button>
        <button className="btn btn-secondary" onClick={handleImport}>
          Import dashboard
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
