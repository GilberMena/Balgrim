import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "balgrim-backend",
    timestamp: new Date().toISOString(),
  });
});

export default router;
