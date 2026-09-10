import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Admin sees everyone; a PM only needs the developer roster to assign tasks.
router.get(
  "/",
  requireRole("ADMIN", "PM"),
  asyncHandler(async (req, res) => {
    const where = req.user!.role === "PM" ? { role: "DEVELOPER" as const } : {};
    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  })
);

export default router;
