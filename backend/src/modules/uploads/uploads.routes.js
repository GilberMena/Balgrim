import { Router } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { requireAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "../../../uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const safeBase = path
      .basename(file.originalname || "balgrim-image", extension)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "balgrim-image";
    cb(null, `${Date.now()}-${safeBase}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new Error("Solo se permiten imagenes."));
      return;
    }
    cb(null, true);
  },
});

router.post("/", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se recibio ninguna imagen." });
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return res.json({
    file: {
      filename: req.file.filename,
      url: `${baseUrl}/uploads/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
  });
});

router.delete("/:filename", requireAdmin, (req, res) => {
  const filename = path.basename(req.params.filename || "");
  if (!filename) {
    return res.status(400).json({ error: "Archivo invalido." });
  }

  const filePath = path.resolve(uploadDir, filename);
  if (!filePath.startsWith(uploadDir)) {
    return res.status(400).json({ error: "Ruta invalida." });
  }

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return res.json({ ok: true, filename });
});

export default router;
