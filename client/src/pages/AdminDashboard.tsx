import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { ActivityFeed } from "../components/ActivityFeed";
import type { TaskStatus } from "../types";

interface AdminStats {
  totalProjects: number;
  tasksByStatus: Partial<Record<TaskStatus, number>>;
  overdueCount: number;
  onlineUsers: number;
}

export function AdminDashboard() {
  const socket = useSocket();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    api.get("/dashboard").then((res) => setStats(res.data));
  }, []);

  useEffect(() => {
    if (!socket) return;
    function handlePresence(count: number) {
      setStats((prev) => (prev ? { ...prev, onlineUsers: count } : prev));
    }
    socket.on("presence:count", handlePresence);
    return () => {
      socket.off("presence:count", handlePresence);
    };
  }, [socket]);

  if (!stats) return <p>Loading...</p>;

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.totalProjects}</span>
          <span className="stat-label">Total projects</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.overdueCount}</span>
          <span className="stat-label">Overdue tasks</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.onlineUsers}</span>
          <span className="stat-label">Users online now</span>
        </div>
        {Object.entries(stats.tasksByStatus).map(([status, count]) => (
          <div className="stat-card" key={status}>
            <span className="stat-value">{count}</span>
            <span className="stat-label">{status.replace("_", " ")}</span>
          </div>
        ))}
      </div>
      <ActivityFeed title="Global activity" />
    </div>
  );
}
