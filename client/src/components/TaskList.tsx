import { api } from "../api/client";
import type { Task, TaskStatus } from "../types";

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

export function TaskList({
  tasks,
  onChanged,
  showAssignee = true,
  showProject = false,
}: {
  tasks: Task[];
  onChanged: () => void;
  showAssignee?: boolean;
  showProject?: boolean;
}) {
  async function changeStatus(taskId: string, status: TaskStatus) {
    await api.patch(`/tasks/${taskId}`, { status });
    onChanged();
  }

  if (tasks.length === 0) return <p className="muted">No tasks match these filters.</p>;

  return (
    <table className="task-table">
      <thead>
        <tr>
          <th>Task</th>
          {showProject && <th>Project</th>}
          {showAssignee && <th>Assignee</th>}
          <th>Priority</th>
          <th>Due</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id} className={task.isOverdue ? "overdue" : ""}>
            <td>
              #{task.number} {task.title}
            </td>
            {showProject && <td>{task.project?.name}</td>}
            {showAssignee && <td>{task.assignee?.name ?? "Unassigned"}</td>}
            <td>
              <span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
            </td>
            <td>
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
              {task.isOverdue && <span className="overdue-tag">Overdue</span>}
            </td>
            <td>
              <select value={task.status} onChange={(e) => changeStatus(task.id, e.target.value as TaskStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
