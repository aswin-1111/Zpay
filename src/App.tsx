import { Routes, Route } from "react-router-dom";
import "./App.css";
import StartPage from "./Start";
import DashboardPage from "./Dashboard";
import Loading from "./Loading";
import ChartEditorWindow from "./ChartEditorWindow";
import StatementsWindow from "./StatementsWindow";
import DefaultDashboardWindow from "./DefaultDashboardWindow";
import AiSettingsWindow from "./AiSettingsWindow";
import { useThemeStore } from "./store/themeStore";

// Applied once per window, as early as possible (module scope, not inside the
// component) so there's no flash of the wrong theme before first paint. Every
// window loads this same App.tsx module, so this covers all of them uniformly.
useThemeStore.getState().init();

function App() {
  // The chart editor, the saved-statements list, the default-dashboard-template
  // editor, and the AI settings form each open as a separate Tauri window pointed
  // at index.html?editor=chart&... / ?window=statements / ?window=default-dashboard-editor
  // / ?window=ai-settings — handled here, before the router, since they're distinct
  // top-level windows rather than routes within the main app.
  const params = new URLSearchParams(window.location.search);
  if (params.get("editor") === "chart") {
    return <ChartEditorWindow />;
  }
  if (params.get("window") === "statements") {
    return <StatementsWindow />;
  }
  if (params.get("window") === "default-dashboard-editor") {
    return <DefaultDashboardWindow />;
  }
  if (params.get("window") === "ai-settings") {
    return <AiSettingsWindow />;
  }

  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/loading" element={<Loading />} />
    </Routes>
  );
}

export default App;
