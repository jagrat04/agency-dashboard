import { Navigate, Route, Routes, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NotificationBell } from "./components/NotificationBell";
import { Login } from "./pages/Login";
import { AdminDashboard } from "./pages/AdminDashboard";
import { PMDashboard } from "./pages/PMDashboard";
import { DeveloperDashboard } from "./pages/DeveloperDashboard";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";

function Home() {
  const { user } = useAuth();
  if (user?.role === "ADMIN") return <AdminDashboard />;
  if (user?.role === "PM") return <PMDashboard />;
  return <DeveloperDashboard />;
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <nav className="app-nav">
        <Link to="/" className="brand">
          Agency Dashboard
        </Link>
        <Link to="/projects">Projects</Link>
        <div className="nav-spacer" />
        {user && <NotificationBell />}
        {user && (
          <span className="nav-user">
            {user.name} ({user.role})
          </span>
        )}
        {user && <button onClick={logout}>Logout</button>}
      </nav>
      <main className="app-main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <Projects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute>
                  <ProjectDetail />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </SocketProvider>
    </AuthProvider>
  );
}
