import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import "./App.css";
import { openSavedStatementsWindow } from "./lib/statementsWindow";

function StartPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);

  const handleProceed = async () => {
    if (!file) return;
    navigate("/loading", {
      state: { file },
    });
  };

  // Opening a statement from the Saved Statements window while sitting on this
  // page should jump straight to its dashboard.
  useEffect(() => {
    const unlisten = listen<{ statementId: string }>("zpay://statement-selected", (event) => {
      navigate("/dashboard", { state: { statementId: event.payload.statementId } });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [navigate]);

  return (
    <main className="app-page app-page--centered">
      <h1>Upload File</h1>
      <div className="input-group">
        <label className="form-label">Select Excel File</label>
        <br />
        <div className="row-inline">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="input-file"
            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
          />
          <button className="btn" disabled={!file} onClick={handleProceed}>
            Proceed
          </button>
        </div>
      </div>
      <button className="btn btn-secondary" onClick={() => openSavedStatementsWindow()}>
        Saved statements
      </button>
    </main>
  );
}

export default StartPage;

