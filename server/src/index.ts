import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { initSocket } from "./lib/socket";
import { startOverdueJob } from "./jobs/overdueJob";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import clientRoutes from "./routes/client.routes";
import projectRoutes from "./routes/project.routes";
import taskRoutes from "./routes/task.routes";
import activityRoutes from "./routes/activity.routes";
import notificationRoutes from "./routes/notification.routes";
import dashboardRoutes from "./routes/dashboard.routes";

const app = express();

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = http.createServer(app);
initSocket(httpServer);
startOverdueJob();

httpServer.listen(env.port, () => {
  console.log(`Server listening on port ${env.port}`);
});
