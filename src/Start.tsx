import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

function StartPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);

  const handleProceed = async () => {
    if (!file) return;
    navigate("/loading", {
      state: { file },
    });
  };

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
      {/* Remove this later */}
      <button className="btn" onClick={() => navigate("/dashboard")}>Dashboard</button>
    </main>
  );
}

export default StartPage;

