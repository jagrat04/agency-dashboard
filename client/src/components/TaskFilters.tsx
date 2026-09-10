import { useSearchParams } from "react-router-dom";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function TaskFilters() {
  const [params, setParams] = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <div className="filters">
      <select value={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)}>
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
      <select value={params.get("priority") ?? ""} onChange={(e) => update("priority", e.target.value)}>
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <label>
        Due from
        <input type="date" value={params.get("dueFrom")?.slice(0, 10) ?? ""} onChange={(e) => update("dueFrom", e.target.value ? new Date(e.target.value).toISOString() : "")} />
      </label>
      <label>
        Due to
        <input type="date" value={params.get("dueTo")?.slice(0, 10) ?? ""} onChange={(e) => update("dueTo", e.target.value ? new Date(e.target.value).toISOString() : "")} />
      </label>
    </div>
  );
}

export function useTaskFilterParams() {
  const [params] = useSearchParams();
  return {
    status: params.get("status") || undefined,
    priority: params.get("priority") || undefined,
    dueFrom: params.get("dueFrom") || undefined,
    dueTo: params.get("dueTo") || undefined,
  };
}
