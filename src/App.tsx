import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Players from "./pages/Players";
import BugReports from "./pages/BugReports";
import Maps from "./pages/Maps";

export default function App() {
  return (
    <>
      <nav className="sidebar">
        <div className="brand">
          Hoop <span>Drop</span> Admin
        </div>
        <NavLink to="/" end>
          Panel
        </NavLink>
        <NavLink to="/oyuncular">Oyuncular</NavLink>
        <NavLink to="/bug-raporlari">Bug Raporları</NavLink>
        <NavLink to="/haritalar">Haritalar</NavLink>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/oyuncular" element={<Players />} />
          <Route path="/bug-raporlari" element={<BugReports />} />
          <Route path="/haritalar" element={<Maps />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
