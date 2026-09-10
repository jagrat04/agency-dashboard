import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { timeAgo } from "../lib/time";
import type { ActivityEntry } from "../types";

function formatMessage(entry: ActivityEntry): string {
  if (entry.message) return entry.message;
  if (entry.task && entry.fromValue && entry.toValue) {
    return `${entry.actor.name} ${entry.action} Task #${entry.task.number} from ${entry.fromValue} → ${entry.toValue}`;
  }
  if (entry.task) return `${entry.actor.name} ${entry.action} Task #${entry.task.number}`;
  return `${entry.actor.name} ${entry.action}`;
}

export function ActivityFeed({ projectId, title = "Activity" }: { projectId?: string; title?: string }) {
  const socket = useSocket();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/activity", { params: projectId ? { projectId } : {} })
      .then((res) => {
        if (!cancelled) setEntries(res.data);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!socket) return;
    if (projectId) socket.emit("project:join", projectId);

    function handleNew(entry: ActivityEntry) {
      if (projectId && entry.projectId !== projectId) return;
      setEntries((prev) => [entry, ...prev].slice(0, 50));
    }

    socket.on("activity:new", handleNew);
    return () => {
      socket.off("activity:new", handleNew);
      if (projectId) socket.emit("project:leave", projectId);
    };
  }, [socket, projectId]);

  return (
    <div className="panel">
      <h3>{title}</h3>
      {entries.length === 0 && <p className="muted">No activity yet.</p>}
      <ul className="feed">
        {entries.map((entry) => (
          <li key={entry.id}>
            <span>{formatMessage(entry)}</span>
            <span className="muted"> · {timeAgo(entry.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
