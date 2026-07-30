import { Routes, Route } from "react-router-dom";
import "./App.css";
import StartPage from "./Start";
import DashboardPage from "./Dashboard";
import Loading from "./Loading";
import ChartEditorWindow from "./ChartEditorWindow";
import StatementsWindow from "./StatementsWindow";

function App() {
  // The chart editor and the saved-statements list each open as a separate Tauri
  // window pointed at index.html?editor=chart&... / ?window=statements — handled
  // here, before the router, since they're distinct top-level windows rather than
  // routes within the main app.
  const params = new URLSearchParams(window.location.search);
  if (params.get("editor") === "chart") {
    return <ChartEditorWindow />;
  }
  if (params.get("window") === "statements") {
    return <StatementsWindow />;
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
