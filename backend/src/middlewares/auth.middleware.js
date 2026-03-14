import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export async function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, firstName: true, lastName: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid session." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid session." });
  }
}

export async function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin role required." });
    }
    next();
  });
}

function getToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return req.cookies?.balgrim_token || null;
}
