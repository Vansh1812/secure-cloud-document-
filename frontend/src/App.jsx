import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";

function Topbar() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="topbar">
      <div className="brand">
        <span className="seal">◆</span>
        Vault
      </div>
      <div className="topbar-user">
        <span>{user.name}</span>
        <button className="logout-btn" onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Topbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
