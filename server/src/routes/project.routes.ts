import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { role, id: userId } = req.user!;

    if (role === "ADMIN") {
      const projects = await prisma.project.findMany({
        include: { client: true, manager: { select: { id: true, name: true } }, _count: { select: { tasks: true } } },
        orderBy: { createdAt: "desc" },
      });
      return res.json(projects);
    }

    if (role === "PM") {
      const projects = await prisma.project.findMany({
        where: { managerId: userId },
        include: { client: true, manager: { select: { id: true, name: true } }, _count: { select: { tasks: true } } },
        orderBy: { createdAt: "desc" },
      });
      return res.json(projects);
    }

    // Developer: only projects where they have at least one assigned task.
    const projects = await prisma.project.findMany({
      where: { tasks: { some: { assigneeId: userId } } },
      include: { client: true, manager: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(projects);
  })
);

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  clientId: z.string().min(1),
  managerId: z.string().min(1).optional(),
});

router.post(
  "/",
  requireRole("ADMIN", "PM"),
  validateBody(createProjectSchema),
  asyncHandler(async (req, res) => {
    const { role, id: userId } = req.user!;
    const managerId = role === "PM" ? userId : req.body.managerId;
    if (!managerId) throw new ApiError(400, "managerId is required when an admin creates a project");

    if (role === "ADMIN") {
      const manager = await prisma.user.findUnique({ where: { id: managerId } });
      if (!manager || manager.role !== "PM") throw new ApiError(400, "managerId must belong to a Project Manager");
    }

    const project = await prisma.project.create({
      data: {
        name: req.body.name,
        description: req.body.description,
        clientId: req.body.clientId,
        managerId,
      },
      include: { client: true, manager: { select: { id: true, name: true } } },
    });
    res.status(201).json(project);
  })
);

async function loadProjectForAccess(projectId: string, user: { id: string; role: string }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: true, manager: { select: { id: true, name: true } } },
  });
  if (!project) throw new ApiError(404, "Project not found");

  if (user.role === "ADMIN") return project;
  if (user.role === "PM") {
    if (project.managerId !== user.id) throw new ApiError(403, "You do not manage this project");
    return project;
  }
  // Developer: allowed only if they have a task in this project.
  const hasTask = await prisma.task.findFirst({ where: { projectId, assigneeId: user.id } });
  if (!hasTask) throw new ApiError(403, "You have no tasks in this project");
  return project;
}

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const project = await loadProjectForAccess(req.params.id, req.user!);

    const taskWhere =
      req.user!.role === "DEVELOPER" ? { projectId: project.id, assigneeId: req.user!.id } : { projectId: project.id };

    const tasks = await prisma.task.findMany({
      where: taskWhere,
      include: { assignee: { select: { id: true, name: true } } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    });

    res.json({ ...project, tasks });
  })
);

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});

router.patch(
  "/:id",
  requireRole("ADMIN", "PM"),
  validateBody(updateProjectSchema),
  asyncHandler(async (req, res) => {
    await loadProjectForAccess(req.params.id, req.user!);
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: req.body,
      include: { client: true, manager: { select: { id: true, name: true } } },
    });
    res.json(project);
  })
);

export { loadProjectForAccess };
export default router;
