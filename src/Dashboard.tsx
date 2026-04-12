import { useEffect, useRef } from "react";
import { embedDashboard } from "@superset-ui/embedded-sdk";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

export default function DashboardPage() {

  useEffect(() => {
    async function loadDashboard() {
      const appWindow = getCurrentWindow();
      try {
        await appWindow.maximize();
      } catch (e) {
        console.error("Failed to maximize:", e);
      }

    
    }

    loadDashboard();
  }, []);

  return (
    <div id="editor-container"/>
  );
}