import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { getOnlineCount } from "../lib/socket";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { role, id: userId } = req.user!;

    if (role === "ADMIN") {
      const [totalProjects, tasksByStatus, overdueCount] = await Promise.all([
        prisma.project.count(),
        prisma.task.groupBy({ by: ["status"], _count: true }),
        prisma.task.count({ where: { isOverdue: true } }),
      ]);
      return res.json({
        totalProjects,
        tasksByStatus: Object.fromEntries(tasksByStatus.map((t) => [t.status, t._count])),
        overdueCount,
        onlineUsers: getOnlineCount(),
      });
    }

    if (role === "PM") {
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [projects, tasksByPriority, upcoming] = await Promise.all([
        prisma.project.findMany({
          where: { managerId: userId },
          include: { _count: { select: { tasks: true } } },
        }),
        prisma.task.groupBy({
          by: ["priority"],
          _count: true,
          where: { project: { managerId: userId } },
        }),
        prisma.task.findMany({
          where: {
            project: { managerId: userId },
            dueDate: { gte: new Date(), lte: weekFromNow },
            status: { not: "DONE" },
          },
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { dueDate: "asc" },
        }),
      ]);
      return res.json({
        projects,
        tasksByPriority: Object.fromEntries(tasksByPriority.map((t) => [t.priority, t._count])),
        upcomingDueThisWeek: upcoming,
      });
    }

    const tasks = await prisma.task.findMany({
      where: { assigneeId: userId },
      include: { project: { select: { id: true, name: true } } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    });
    res.json({ tasks });
  })
);

export default router;
