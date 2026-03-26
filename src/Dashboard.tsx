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
      const token = await invoke("get_guest_token");

      embedDashboard({
        id: '95c75743-af17-4127-91d5-6ea06f6b46f1',  // Use the id obtained from enabling embedding dashboard option
        supersetDomain: 'http://localhost:8088',
        mountPoint: document.getElementById("superset-container"), // html element in which iframe will be mounted to show the dashboard
        fetchGuestToken: () => token,
        dashboardUiConfig: { 
          hideTitle: false,
          hideTab:false,
          filters:{
            expanded:true
          },
          urlParams:{
            standalone:3 // here you can add the url_params and there values
          }
        },
        iframeSandboxExtras: ['allow-top-navigation', 'allow-popups-to-escape-sandbox'],
      });
    }

    loadDashboard();
  }, []);

  return (
    <div id="superset-container"/>
  );
  // return (
    // <div className="page">
    //   <h1>Superset Dashboard</h1>
    //   <div id="superset-container"></div>
    // </div>
  // );
}