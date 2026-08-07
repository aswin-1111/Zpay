import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocation, useNavigate } from "react-router-dom";

import "./App.css";
import { parseBankStatement } from "./parser";

const STAGES = ["Reading statement", "Saving statement", "Opening dashboard"] as const;

function Loader() {
  const navigate = useNavigate();
  const location = useLocation();
  const file = location.state?.file as File | undefined;
  const [stage, setStage] = useState<number>(0);

  useEffect(() => {
    if (!file) {
      navigate("/");
      return;
    }

    const processFile = async () => {
      try {
        setStage(0);
        const parsed = await parseBankStatement(file);
        const statementId = crypto.randomUUID();

        setStage(1);
        await invoke("save_statement", {
          data: parsed,
          id: statementId,
          originalFileName: file.name,
          savedAt: new Date().toISOString(),
        });

        setStage(2);
        navigate("/dashboard", { state: { statementId } });
      } catch (err) {
        console.error(err);
        navigate("/");
        alert("Failed to process the uploaded file.");
      }
    };

    processFile();
  }, [file, navigate]);

  return (
    <div className="app-page app-page--centered loading-page">
      <div className="loading-spinner" />
      <p className="loading-status" aria-live="polite">
        {STAGES[stage]}&hellip;
      </p>
      {file && <p className="loading-filename">{file.name}</p>}
    </div>
  );
}

export default Loader;
