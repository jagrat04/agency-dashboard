import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { ActivityFeed } from "../components/ActivityFeed";
import { TaskFilters, useTaskFilterParams } from "../components/TaskFilters";
import { TaskList } from "../components/TaskList";
import type { Task } from "../types";

export function DeveloperDashboard() {
  const filters = useTaskFilterParams();
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = useCallback(() => {
    api.get("/tasks", { params: filters }).then((res) => setTasks(res.data));
  }, [filters.status, filters.priority, filters.dueFrom, filters.dueTo]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1>My Tasks</h1>
      <TaskFilters />
      <TaskList tasks={tasks} onChanged={load} showAssignee={false} showProject />
      <ActivityFeed title="Activity on your tasks" />
    </div>
  );
}
