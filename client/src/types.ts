export type Role = "ADMIN" | "PM" | "DEVELOPER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Client {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  client?: Client;
  managerId: string;
  manager?: { id: string; name: string };
  createdAt: string;
  _count?: { tasks: number };
  tasks?: Task[];
}

export interface Task {
  id: string;
  number: number;
  title: string;
  description: string | null;
  projectId: string;
  project?: { id: string; name: string; managerId?: string };
  assigneeId: string | null;
  assignee?: { id: string; name: string } | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  activities?: ActivityEntry[];
}

export interface ActivityEntry {
  id: string;
  projectId: string;
  taskId: string | null;
  task?: { id: string; number: number; title: string } | null;
  actorId: string;
  actor: { id: string; name: string };
  action: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  message?: string;
}

export type NotificationType = "TASK_ASSIGNED" | "TASK_IN_REVIEW";

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  message: string;
  taskId: string | null;
  isRead: boolean;
  createdAt: string;
}
