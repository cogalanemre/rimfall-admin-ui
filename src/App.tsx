import { useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Players from "./pages/Players";
import Runs from "./pages/Runs";
import BugReports from "./pages/BugReports";
import Maps from "./pages/Maps";

export default function App() {
  // Dar ekranda kenar çubuğu çekmeceye dönüşür; hamburger açar/kapar.
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <>
      <header className="topbar">
        <button
          className="hamburger"
          aria-label="Menü"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="brand">
          Hoop <span>Drop</span> Admin
        </div>
      </header>

      {menuOpen && <div className="nav-overlay" onClick={close} />}

      <nav className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          Hoop <span>Drop</span> Admin
        </div>
        <NavLink to="/" end onClick={close}>
          Panel
        </NavLink>
        <NavLink to="/oyuncular" onClick={close}>
          Oyuncular
        </NavLink>
        <NavLink to="/oyunlar" onClick={close}>
          Oyunlar
        </NavLink>
        <NavLink to="/bug-raporlari" onClick={close}>
          Bug Raporları
        </NavLink>
        <NavLink to="/haritalar" onClick={close}>
          Haritalar
        </NavLink>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/oyuncular" element={<Players />} />
          <Route path="/oyunlar" element={<Runs />} />
          <Route path="/bug-raporlari" element={<BugReports />} />
          <Route path="/haritalar" element={<Maps />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
