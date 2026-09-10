import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "PM"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
    res.json(clients);
  })
);

const createClientSchema = z.object({ name: z.string().min(1).max(200) });

router.post(
  "/",
  validateBody(createClientSchema),
  asyncHandler(async (req, res) => {
    const client = await prisma.client.create({ data: { name: req.body.name } });
    res.status(201).json(client);
  })
);

export default router;
