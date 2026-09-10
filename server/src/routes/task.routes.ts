import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { loadProjectForAccess } from "./project.routes";
import { recordActivity } from "../services/activity.service";
import { createNotification } from "../services/notification.service";

const router = Router();

router.use(requireAuth);

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueFrom: z.string().optional(),
  dueTo: z.string().optional(),
});

router.get(
  "/",
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const { role, id: userId } = req.user!;
    const { projectId, status, priority, dueFrom, dueTo } = req.query as z.infer<typeof listQuerySchema>;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (dueFrom || dueTo) {
      where.dueDate = {
        ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
        ...(dueTo ? { lte: new Date(dueTo) } : {}),
      };
    }

    if (role === "ADMIN") {
      if (projectId) where.projectId = projectId;
    } else if (role === "PM") {
      where.project = { managerId: userId };
      if (projectId) where.projectId = projectId;
    } else {
      // Developer: hard-pinned to their own tasks regardless of query params.
      where.assigneeId = userId;
      if (projectId) where.projectId = projectId;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, managerId: true } },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    });
    res.json(tasks);
  })
);

async function loadTaskForAccess(taskId: string, user: { id: string; role: string }) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new ApiError(404, "Task not found");

  if (user.role === "DEVELOPER") {
    if (task.assigneeId !== user.id) throw new ApiError(403, "Not your task");
  } else {
    await loadProjectForAccess(task.projectId, user);
  }
  return task;
}

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const task = await loadTaskForAccess(req.params.id, req.user!);
    const activities = await prisma.activityLog.findMany({
      where: { taskId: task.id },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ ...task, activities });
  })
);

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  dueDate: z.string().datetime().optional(),
});

router.post(
  "/",
  requireRole("ADMIN", "PM"),
  validateBody(createTaskSchema),
  asyncHandler(async (req, res) => {
    const project = await loadProjectForAccess(req.body.projectId, req.user!);

    if (req.body.assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: req.body.assigneeId } });
      if (!assignee || assignee.role !== "DEVELOPER") throw new ApiError(400, "assigneeId must belong to a Developer");
    }

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: req.body.title,
        description: req.body.description,
        assigneeId: req.body.assigneeId,
        priority: req.body.priority,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      },
      include: { assignee: { select: { id: true, name: true } } },
    });

    await recordActivity({
      projectId: project.id,
      taskId: task.id,
      actorId: req.user!.id,
      action: "created",
    });

    if (task.assigneeId) {
      await createNotification(
        task.assigneeId,
        "TASK_ASSIGNED",
        `You were assigned to Task #${task.number}: ${task.title}`,
        task.id
      );
    }

    res.status(201).json(task);
  })
);

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  assigneeId: z.string().nullable().optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

router.patch(
  "/:id",
  validateBody(updateTaskSchema),
  asyncHandler(async (req, res) => {
    const { role, id: userId } = req.user!;
    const existing = await loadTaskForAccess(req.params.id, req.user!);

    // Developers may only move status on their own task; everything else is PM/Admin territory.
    const body = req.body as z.infer<typeof updateTaskSchema>;
    if (role === "DEVELOPER") {
      const disallowed = Object.keys(body).some((key) => key !== "status");
      if (disallowed) throw new ApiError(403, "Developers may only update task status");
    }

    if (body.assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: body.assigneeId } });
      if (!assignee || assignee.role !== "DEVELOPER") throw new ApiError(400, "assigneeId must belong to a Developer");
    }

    const data: Record<string, unknown> = { ...body };
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.status) data.isOverdue = false;

    const updated = await prisma.task.update({
      where: { id: existing.id },
      data,
      include: { assignee: { select: { id: true, name: true } }, project: true },
    });

    if (body.status && body.status !== existing.status) {
      await recordActivity({
        projectId: updated.projectId,
        taskId: updated.id,
        actorId: userId,
        action: "moved",
        fromValue: STATUS_LABELS[existing.status],
        toValue: STATUS_LABELS[body.status],
      });

      if (body.status === "IN_REVIEW") {
        await createNotification(
          updated.project.managerId,
          "TASK_IN_REVIEW",
          `Task #${updated.number}: ${updated.title} was moved to In Review`,
          updated.id
        );
      }
    }

    if (body.assigneeId && body.assigneeId !== existing.assigneeId) {
      await recordActivity({
        projectId: updated.projectId,
        taskId: updated.id,
        actorId: userId,
        action: "reassigned",
      });
      await createNotification(
        body.assigneeId,
        "TASK_ASSIGNED",
        `You were assigned to Task #${updated.number}: ${updated.title}`,
        updated.id
      );
    }

    res.json(updated);
  })
);

export default router;
