import { Routes, Route } from "react-router-dom";
import "./App.css";
import StartPage from "./Start";
import DashboardPage from "./Dashboard";
import Loading from "./Loading";
import ChartEditorWindow from "./ChartEditorWindow";

function App() {
  // The chart editor opens as a separate Tauri window pointed at
  // index.html?editor=chart&... — handled here, before the router, since it's
  // a distinct top-level window rather than a route within the main app.
  if (new URLSearchParams(window.location.search).get("editor") === "chart") {
    return <ChartEditorWindow />;
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
