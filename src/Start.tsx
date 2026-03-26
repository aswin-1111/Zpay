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
    <main className="container">
      <h1>Upload File</h1>
      <div className="input-group">
        <label className="file-label">Select Excel File</label>
        <br />
        <div className="input-button-row">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="file-input"
            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
          />
          <button className="proceed-button" disabled={!file} onClick={handleProceed}>
            Proceed
          </button>
        </div>
      </div>
      {/* Remove this later */}
      <button className="proceed-button" onClick={() => navigate("/dashboard")}>Dashboard</button>
    </main>
  );
}

export default StartPage;

