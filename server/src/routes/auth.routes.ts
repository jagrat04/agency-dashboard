import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from "../lib/tokens";
import { env } from "../config/env";

const router = Router();

const REFRESH_COOKIE = "refreshToken";
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  // Frontend (Vercel) and backend (Render/Railway) are different domains in
  // production, so the cookie needs SameSite=None to survive the cross-site
  // request. Locally both run on localhost (different ports only, same site),
  // where Lax already works and None would require secure:true over http.
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/api/auth",
  maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(401, "Invalid credentials");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new ApiError(401, "Invalid credentials");

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = await issueRefreshToken(user.id);

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const oldToken = req.cookies?.[REFRESH_COOKIE];
    if (!oldToken) throw new ApiError(401, "No refresh token");

    const rotated = await rotateRefreshToken(oldToken);
    if (!rotated) {
      res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
      throw new ApiError(401, "Refresh token invalid or expired");
    }

    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user) throw new ApiError(401, "User not found");

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    res.cookie(REFRESH_COOKIE, rotated.newToken, cookieOptions);
    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await revokeRefreshToken(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.status(204).send();
  })
);

export default router;
