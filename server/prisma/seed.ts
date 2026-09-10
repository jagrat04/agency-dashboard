import { PrismaClient, TaskStatus, TaskPriority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123";

async function main() {
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.create({
    data: { name: "Aditi Rao", email: "admin@agency.dev", passwordHash, role: "ADMIN" },
  });

  const [pm1, pm2] = await Promise.all([
    prisma.user.create({ data: { name: "Karan Mehta", email: "pm1@agency.dev", passwordHash, role: "PM" } }),
    prisma.user.create({ data: { name: "Neha Kapoor", email: "pm2@agency.dev", passwordHash, role: "PM" } }),
  ]);

  const [dev1, dev2, dev3, dev4] = await Promise.all([
    prisma.user.create({ data: { name: "Ravi Sharma", email: "dev1@agency.dev", passwordHash, role: "DEVELOPER" } }),
    prisma.user.create({ data: { name: "Priya Nair", email: "dev2@agency.dev", passwordHash, role: "DEVELOPER" } }),
    prisma.user.create({ data: { name: "Amit Verma", email: "dev3@agency.dev", passwordHash, role: "DEVELOPER" } }),
    prisma.user.create({ data: { name: "Sneha Iyer", email: "dev4@agency.dev", passwordHash, role: "DEVELOPER" } }),
  ]);

  const [clientA, clientB, clientC] = await Promise.all([
    prisma.client.create({ data: { name: "Northwind Retail" } }),
    prisma.client.create({ data: { name: "Bluepeak Finance" } }),
    prisma.client.create({ data: { name: "Orbit Health" } }),
  ]);

  const projectAlpha = await prisma.project.create({
    data: { name: "Storefront Revamp", description: "Rebuild the e-commerce frontend", clientId: clientA.id, managerId: pm1.id },
  });
  const projectBeta = await prisma.project.create({
    data: { name: "Ledger Migration", description: "Move ledger service to new schema", clientId: clientB.id, managerId: pm1.id },
  });
  const projectGamma = await prisma.project.create({
    data: { name: "Patient Portal", description: "Self-serve appointment booking", clientId: clientC.id, managerId: pm2.id },
  });

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  type TaskSeed = {
    title: string;
    description: string;
    assigneeId: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | null;
    isOverdue?: boolean;
  };

  async function seedProjectTasks(projectId: string, tasks: TaskSeed[]) {
    const created = [];
    for (const t of tasks) {
      const task = await prisma.task.create({
        data: {
          projectId,
          title: t.title,
          description: t.description,
          assigneeId: t.assigneeId,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          isOverdue: t.isOverdue ?? false,
        },
      });
      created.push(task);
      await prisma.activityLog.create({
        data: {
          projectId,
          taskId: task.id,
          actorId: t.assigneeId,
          action: "created",
          createdAt: new Date(now - 6 * day),
        },
      });
    }
    return created;
  }

  const alphaTasks = await seedProjectTasks(projectAlpha.id, [
    { title: "Design new product grid", description: "Responsive grid layout", assigneeId: dev1.id, status: "DONE", priority: "MEDIUM", dueDate: new Date(now - 3 * day) },
    { title: "Build checkout flow", description: "Multi-step checkout with validation", assigneeId: dev1.id, status: "IN_PROGRESS", priority: "HIGH", dueDate: new Date(now + 4 * day) },
    { title: "Integrate payment gateway", description: "Stripe integration", assigneeId: dev2.id, status: "TODO", priority: "CRITICAL", dueDate: new Date(now + 2 * day) },
    { title: "Fix cart total rounding bug", description: "Off-by-cent rounding on tax", assigneeId: dev2.id, status: "IN_REVIEW", priority: "MEDIUM", dueDate: new Date(now + 1 * day) },
    { title: "Migrate legacy CSS", description: "Replace old stylesheet with design tokens", assigneeId: dev1.id, status: "TODO", priority: "LOW", dueDate: new Date(now - 2 * day), isOverdue: true },
  ]);

  const betaTasks = await seedProjectTasks(projectBeta.id, [
    { title: "Write migration scripts", description: "Schema diff scripts", assigneeId: dev3.id, status: "IN_PROGRESS", priority: "HIGH", dueDate: new Date(now + 5 * day) },
    { title: "Backfill historical ledger rows", description: "Batch job for old records", assigneeId: dev3.id, status: "TODO", priority: "CRITICAL", dueDate: new Date(now - 1 * day), isOverdue: true },
    { title: "Add reconciliation report", description: "Daily reconciliation export", assigneeId: dev4.id, status: "TODO", priority: "MEDIUM", dueDate: new Date(now + 6 * day) },
    { title: "Audit foreign key constraints", description: "Verify referential integrity post-migration", assigneeId: dev4.id, status: "IN_REVIEW", priority: "HIGH", dueDate: new Date(now + 3 * day) },
    { title: "Load test new ledger service", description: "k6 load test suite", assigneeId: dev3.id, status: "DONE", priority: "MEDIUM", dueDate: new Date(now - 4 * day) },
  ]);

  const gammaTasks = await seedProjectTasks(projectGamma.id, [
    { title: "Appointment booking UI", description: "Calendar-based booking flow", assigneeId: dev4.id, status: "IN_PROGRESS", priority: "HIGH", dueDate: new Date(now + 2 * day) },
    { title: "Doctor availability API", description: "REST endpoint for open slots", assigneeId: dev2.id, status: "TODO", priority: "HIGH", dueDate: new Date(now + 7 * day) },
    { title: "SMS reminder integration", description: "Twilio reminders 24h before visit", assigneeId: dev2.id, status: "TODO", priority: "MEDIUM", dueDate: new Date(now + 8 * day) },
    { title: "Accessibility pass", description: "WCAG AA audit and fixes", assigneeId: dev4.id, status: "IN_REVIEW", priority: "LOW", dueDate: new Date(now + 1 * day) },
    { title: "Patient record export", description: "PDF export of visit history", assigneeId: dev4.id, status: "DONE", priority: "MEDIUM", dueDate: new Date(now - 5 * day) },
    { title: "Insurance verification step", description: "Verify coverage before booking confirms", assigneeId: dev2.id, status: "TODO", priority: "CRITICAL", dueDate: new Date(now + 3 * day) },
  ]);

  // A few more recent activity entries so the live feed has a natural, varied history.
  const recentTask = alphaTasks[3];
  await prisma.activityLog.create({
    data: {
      projectId: projectAlpha.id,
      taskId: recentTask.id,
      actorId: dev2.id,
      action: "moved",
      fromValue: "In Progress",
      toValue: "In Review",
      createdAt: new Date(now - 10 * 60 * 1000),
    },
  });
  await prisma.notification.create({
    data: {
      recipientId: pm1.id,
      type: "TASK_IN_REVIEW",
      message: `Task #${recentTask.number}: ${recentTask.title} was moved to In Review`,
      taskId: recentTask.id,
      createdAt: new Date(now - 10 * 60 * 1000),
    },
  });

  const betaReviewTask = betaTasks[3];
  await prisma.activityLog.create({
    data: {
      projectId: projectBeta.id,
      taskId: betaReviewTask.id,
      actorId: dev4.id,
      action: "moved",
      fromValue: "In Progress",
      toValue: "In Review",
      createdAt: new Date(now - 45 * 60 * 1000),
    },
  });

  const gammaReviewTask = gammaTasks[3];
  await prisma.activityLog.create({
    data: {
      projectId: projectGamma.id,
      taskId: gammaReviewTask.id,
      actorId: dev4.id,
      action: "moved",
      fromValue: "In Progress",
      toValue: "In Review",
      createdAt: new Date(now - 2 * 60 * 60 * 1000),
    },
  });

  for (const t of [alphaTasks[2], gammaTasks[5]]) {
    await prisma.notification.create({
      data: {
        recipientId: t.assigneeId!,
        type: "TASK_ASSIGNED",
        message: `You were assigned to Task #${t.number}: ${t.title}`,
        taskId: t.id,
        createdAt: new Date(now - 5 * day),
      },
    });
  }

  console.log("Seed complete.");
  console.log("Login with password:", PASSWORD);
  console.log({
    admin: admin.email,
    pms: [pm1.email, pm2.email],
    developers: [dev1.email, dev2.email, dev3.email, dev4.email],
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
