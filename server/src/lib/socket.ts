import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "./tokens";
import { env } from "../config/env";
import type { Role } from "@prisma/client";

let io: Server | null = null;

// userId -> number of connected sockets (a user can have multiple tabs open)
const onlineUsers = new Map<string, number>();

function adjustPresence(userId: string, delta: 1 | -1) {
  const current = onlineUsers.get(userId) ?? 0;
  const next = current + delta;
  if (next <= 0) onlineUsers.delete(userId);
  else onlineUsers.set(userId, next);
  io?.to("role:admin").emit("presence:count", onlineUsers.size);
}

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
  });

  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("no token");
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role as Role;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, role } = socket.data as { userId: string; role: Role };

    socket.join(`user:${userId}`);
    if (role === "ADMIN") socket.join("role:admin");
    adjustPresence(userId, 1);

    socket.on("project:join", (projectId: string) => {
      if (typeof projectId === "string") socket.join(`project:${projectId}`);
    });

    socket.on("project:leave", (projectId: string) => {
      if (typeof projectId === "string") socket.leave(`project:${projectId}`);
    });

    socket.on("disconnect", () => {
      adjustPresence(userId, -1);
    });
  });

  return io;
}

export function getIo(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

export function getOnlineCount(): number {
  return onlineUsers.size;
}
