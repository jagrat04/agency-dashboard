import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ActivityFeed } from "../components/ActivityFeed";
import type { Project, TaskPriority, Task } from "../types";

interface PMStats {
  projects: Project[];
  tasksByPriority: Partial<Record<TaskPriority, number>>;
  upcomingDueThisWeek: Task[];
}

export function PMDashboard() {
  const [stats, setStats] = useState<PMStats | null>(null);

  useEffect(() => {
    api.get("/dashboard").then((res) => setStats(res.data));
  }, []);

  if (!stats) return <p>Loading...</p>;

  return (
    <div>
      <h1>Project Manager Dashboard</h1>

      <div className="panel">
        <h3>Your projects</h3>
        <ul>
          {stats.projects.map((p) => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`}>{p.name}</Link> — {p._count?.tasks ?? 0} tasks
            </li>
          ))}
        </ul>
      </div>

      <div className="stat-grid">
        {Object.entries(stats.tasksByPriority).map(([priority, count]) => (
          <div className="stat-card" key={priority}>
            <span className="stat-value">{count}</span>
            <span className="stat-label">{priority} priority</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>Due this week</h3>
        {stats.upcomingDueThisWeek.length === 0 && <p className="muted">Nothing due this week.</p>}
        <ul>
          {stats.upcomingDueThisWeek.map((t) => (
            <li key={t.id}>
              #{t.number} {t.title} — {t.assignee?.name ?? "Unassigned"} — {t.dueDate && new Date(t.dueDate).toLocaleDateString()}
            </li>
          ))}
        </ul>
      </div>

      <ActivityFeed title="Your projects' activity" />
    </div>
  );
}
