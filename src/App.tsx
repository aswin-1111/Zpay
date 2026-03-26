import { Routes, Route } from "react-router-dom";
import "./App.css";
import StartPage from "./Start";
import DashboardPage from "./Dashboard";
import Loading from "./Loading";

function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/loading" element={<Loading />} />
    </Routes>
  );
}

export default App;
