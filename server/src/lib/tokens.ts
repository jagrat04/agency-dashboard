import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.accessTokenTtl as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtAccessSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function rotateRefreshToken(oldToken: string) {
  const existing = await prisma.refreshToken.findUnique({ where: { token: oldToken } });
  if (!existing || existing.expiresAt < new Date()) return null;

  // deleteMany (not delete) so a concurrent rotation of the same token can't throw
  // on an already-gone row — whichever request deletes the row wins the rotation.
  const { count } = await prisma.refreshToken.deleteMany({ where: { token: oldToken } });
  if (count === 0) return null;

  const newToken = await issueRefreshToken(existing.userId);
  return { userId: existing.userId, newToken };
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}
