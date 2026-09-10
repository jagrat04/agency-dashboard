import cron from "node-cron";
import { prisma } from "../lib/prisma";

// Runs every minute: cheap query, single UPDATE, no external queue needed for one job.
export function startOverdueJob() {
  cron.schedule("* * * * *", async () => {
    await prisma.task.updateMany({
      where: {
        isOverdue: false,
        dueDate: { lt: new Date() },
        status: { not: "DONE" },
      },
      data: { isOverdue: true },
    });
  });
}
