import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { timeAgo } from "../lib/time";
import type { Notification } from "../types";

export function NotificationBell() {
  const socket = useSocket();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.get("/notifications").then((res) => {
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    function handleNew(payload: { notification: Notification; unreadCount: number }) {
      setNotifications((prev) => [payload.notification, ...prev].slice(0, 50));
      setUnreadCount(payload.unreadCount);
    }
    socket.on("notification:new", handleNew);
    return () => {
      socket.off("notification:new", handleNew);
    };
  }, [socket]);

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await api.patch("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div className="notification-bell">
      <button onClick={() => setOpen((o) => !o)}>
        Notifications {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <strong>Notifications</strong>
            <button onClick={markAllRead}>Mark all read</button>
          </div>
          {notifications.length === 0 && <p className="muted">No notifications.</p>}
          <ul>
            {notifications.map((n) => (
              <li key={n.id} className={n.isRead ? "read" : "unread"} onClick={() => !n.isRead && markRead(n.id)}>
                <span>{n.message}</span>
                <span className="muted"> · {timeAgo(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
