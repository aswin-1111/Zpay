import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { GraphicWalker } from "@kanaries/graphic-walker";
import type { IMutField } from "@kanaries/graphic-walker";
// import "@kanaries/graphic-walker/dist/style.css";
import "./App.css";

export default function DashboardPage() {
  const sampleData = [
    { month: "Jan", channel: "UPI", users: 1240, revenue: 18600 },
    { month: "Jan", channel: "Card", users: 860, revenue: 14700 },
    { month: "Feb", channel: "UPI", users: 1390, revenue: 21420 },
    { month: "Feb", channel: "Card", users: 910, revenue: 15640 },
    { month: "Mar", channel: "UPI", users: 1550, revenue: 24230 },
    { month: "Mar", channel: "Card", users: 980, revenue: 16810 },
    { month: "Apr", channel: "UPI", users: 1710, revenue: 26950 },
    { month: "Apr", channel: "Card", users: 1060, revenue: 18240 },
  ];

  const sampleFields: IMutField[] = [
    { fid: "month", name: "month", analyticType: "dimension", semanticType: "nominal" },
    { fid: "channel", name: "channel", analyticType: "dimension", semanticType: "nominal" },
    { fid: "users", name: "users", analyticType: "measure", semanticType: "quantitative" },
    { fid: "revenue", name: "revenue", analyticType: "measure", semanticType: "quantitative" },
  ];

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
    <div className="app-shell">
      <div className="app-surface">
        <GraphicWalker
          data={sampleData}
          fields={sampleFields}
          keepAlive={false}
          appearance="dark"
          style={{ height: "100%" }}
          defaultConfig={{
            layout: {
              showTableSummary: true,
            },
          }}
        />
      </div>
    </div>
  );
}