import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Client, Project, User } from "../types";

export function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [managerId, setManagerId] = useState("");

  const canCreate = user?.role === "ADMIN" || user?.role === "PM";

  function load() {
    api.get("/projects").then((res) => setProjects(res.data));
  }

  useEffect(() => {
    load();
    if (canCreate) {
      api.get("/clients").then((res) => setClients(res.data));
    }
    if (user?.role === "ADMIN") {
      api.get("/users").then((res) => setManagers(res.data.filter((u: User) => u.role === "PM")));
    }
  }, [user?.role]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/projects", {
      name,
      description: description || undefined,
      clientId,
      managerId: user?.role === "ADMIN" ? managerId : undefined,
    });
    setName("");
    setDescription("");
    setClientId("");
    setManagerId("");
    setShowForm(false);
    load();
  }

  return (
    <div>
      <h1>Projects</h1>
      {canCreate && (
        <button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "New project"}</button>
      )}
      {showForm && (
        <form className="inline-form" onSubmit={createProject}>
          <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {user?.role === "ADMIN" && (
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)} required>
              <option value="">Select manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <button type="submit">Create</button>
        </form>
      )}
      <ul className="project-list">
        {projects.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`}>{p.name}</Link>
            <span className="muted"> — {p.client?.name} — managed by {p.manager?.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
