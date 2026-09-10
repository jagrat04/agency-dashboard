import { prisma } from "../lib/prisma";
import { getIo } from "../lib/socket";
import type { NotificationType } from "@prisma/client";

export async function createNotification(
  recipientId: string,
  type: NotificationType,
  message: string,
  taskId?: string
) {
  const notification = await prisma.notification.create({
    data: { recipientId, type, message, taskId },
  });

  const unreadCount = await prisma.notification.count({
    where: { recipientId, isRead: false },
  });

  getIo().to(`user:${recipientId}`).emit("notification:new", { notification, unreadCount });

  return notification;
}
