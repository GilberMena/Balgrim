import { loginSchema } from "./auth.schemas.js";
import { loginAdmin } from "./auth.service.js";

export async function login(req, res) {
  const payload = loginSchema.parse(req.body);
  const session = await loginAdmin(payload);

  res.cookie("balgrim_token", session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });

  res.json(session);
}

export async function me(req, res) {
  res.json({ user: req.user });
}
