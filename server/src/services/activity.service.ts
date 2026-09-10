import { prisma } from "../lib/prisma";
import { getIo } from "../lib/socket";

interface RecordActivityInput {
  projectId: string;
  taskId?: string;
  actorId: string;
  action: string;
  fromValue?: string | null;
  toValue?: string | null;
}

export async function recordActivity(input: RecordActivityInput) {
  const entry = await prisma.activityLog.create({
    data: {
      projectId: input.projectId,
      taskId: input.taskId,
      actorId: input.actorId,
      action: input.action,
      fromValue: input.fromValue ?? null,
      toValue: input.toValue ?? null,
    },
    include: {
      actor: { select: { id: true, name: true } },
      task: { select: { id: true, number: true, title: true, assigneeId: true } },
      project: { select: { id: true, managerId: true } },
    },
  });

  const io = getIo();
  const rooms = new Set<string>([`project:${entry.projectId}`, "role:admin", `user:${entry.project.managerId}`]);
  if (entry.task?.assigneeId) rooms.add(`user:${entry.task.assigneeId}`);

  for (const room of rooms) {
    io.to(room).emit("activity:new", entry);
  }

  return entry;
}

export function formatActivityMessage(entry: {
  actor: { name: string };
  task: { number: number } | null;
  action: string;
  fromValue: string | null;
  toValue: string | null;
}): string {
  if (entry.task && entry.fromValue && entry.toValue) {
    return `${entry.actor.name} ${entry.action} Task #${entry.task.number} from ${entry.fromValue} → ${entry.toValue}`;
  }
  if (entry.task) {
    return `${entry.actor.name} ${entry.action} Task #${entry.task.number}`;
  }
  return `${entry.actor.name} ${entry.action}`;
}
