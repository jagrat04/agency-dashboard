import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { formatActivityMessage } from "../services/activity.service";

const router = Router();

router.use(requireAuth);

const querySchema = z.object({
  projectId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Role-scoped feed. Also serves as missed-event catchup: a client that was
// offline calls this on reconnect and renders whatever it doesn't already have.
router.get(
  "/",
  validateQuery(querySchema),
  asyncHandler(async (req, res) => {
    const { role, id: userId } = req.user!;
    const { projectId, limit } = req.query as unknown as z.infer<typeof querySchema>;

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;

    if (role === "PM") {
      where.project = { managerId: userId };
    } else if (role === "DEVELOPER") {
      where.task = { assigneeId: userId };
    }

    const entries = await prisma.activityLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true } },
        task: { select: { id: true, number: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json(entries.map((entry) => ({ ...entry, message: formatActivityMessage(entry) })));
  })
);

export default router;
