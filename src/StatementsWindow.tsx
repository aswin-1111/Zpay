import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

import { useStatementStore } from "./store/statementStore";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatSavedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StatementsWindow() {
  const statements = useStatementStore((s) => s.statements);
  const loaded = useStatementStore((s) => s.loaded);
  const load = useStatementStore((s) => s.load);
  const remove = useStatementStore((s) => s.remove);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpen = async (statementId: string) => {
    await emit("zpay://statement-selected", { statementId });
    await getCurrentWindow().close();
  };

  const handleDelete = async (statementId: string) => {
    if (!confirm("Delete this saved statement and its dashboards? This can't be undone.")) return;
    setBusyId(statementId);
    try {
      await remove(statementId);
      await emit("zpay://statement-deleted", { statementId });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="statements-page">
      <div className="statements-header">
        <h1>Saved statements</h1>
      </div>

      {!loaded ? (
        <div className="app-page app-page--centered">
          <div className="loading-spinner" />
        </div>
      ) : statements.length === 0 ? (
        <p className="statements-empty">No saved statements yet — upload a bank statement to get started.</p>
      ) : (
        <div className="statements-table-wrap">
          <table className="statements-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Account number</th>
                <th>Branch</th>
                <th>Statement period</th>
                <th>Saved</th>
                <th>Transactions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {statements.map((s) => (
                <tr key={s.id}>
                  <td>{s.accountName || s.originalFileName}</td>
                  <td>{s.accountNumberMasked}</td>
                  <td>{s.branch || "—"}</td>
                  <td>
                    {formatDate(s.startDate)} – {formatDate(s.endDate)}
                  </td>
                  <td>{formatSavedAt(s.savedAt)}</td>
                  <td>{s.transactionCount}</td>
                  <td className="statements-row-actions">
                    <button className="btn btn-icon" onClick={() => handleOpen(s.id)}>
                      Open
                    </button>
                    <button
                      className="btn btn-icon btn-danger"
                      disabled={busyId === s.id}
                      onClick={() => handleDelete(s.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
