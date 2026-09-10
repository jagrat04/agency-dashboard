import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { ActivityFeed } from "../components/ActivityFeed";
import { TaskFilters, useTaskFilterParams } from "../components/TaskFilters";
import { TaskList } from "../components/TaskList";
import type { Project, Task, User, TaskPriority } from "../types";

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const socket = useSocket();
  const filters = useTaskFilterParams();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  const canManage = user?.role === "ADMIN" || (user?.role === "PM" && project?.managerId === user.id);

  const loadTasks = useCallback(() => {
    if (!id) return;
    api.get("/tasks", { params: { projectId: id, ...filters } }).then((res) => setTasks(res.data));
  }, [id, filters.status, filters.priority, filters.dueFrom, filters.dueTo]);

  useEffect(() => {
    if (!id) return;
    api.get(`/projects/${id}`).then((res) => setProject(res.data));
  }, [id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (canManage) api.get("/users").then((res) => setDevelopers(res.data.filter((u: User) => u.role === "DEVELOPER")));
  }, [canManage]);

  useEffect(() => {
    if (!socket) return;
    function handleActivity() {
      loadTasks();
    }
    socket.on("activity:new", handleActivity);
    return () => {
      socket.off("activity:new", handleActivity);
    };
  }, [socket, loadTasks]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    await api.post("/tasks", {
      projectId: id,
      title,
      description: description || undefined,
      assigneeId: assigneeId || undefined,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
    setTitle("");
    setDescription("");
    setAssigneeId("");
    setPriority("MEDIUM");
    setDueDate("");
    setShowForm(false);
    loadTasks();
  }

  if (!project) return <p>Loading...</p>;

  return (
    <div>
      <h1>{project.name}</h1>
      <p className="muted">
        Client: {project.client?.name} — Managed by {project.manager?.name}
      </p>
      {project.description && <p>{project.description}</p>}

      {canManage && (
        <>
          <button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "New task"}</button>
          {showForm && (
            <form className="inline-form" onSubmit={createTask}>
              <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {developers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <button type="submit">Create</button>
            </form>
          )}
        </>
      )}

      <TaskFilters />
      <TaskList tasks={tasks} onChanged={loadTasks} />

      <ActivityFeed projectId={project.id} title="Project activity" />
    </div>
  );
}
