import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import apiRoutes from "./routes/index.js";

export function createApp() {
  const app = express();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadsDir = path.resolve(__dirname, "../uploads");

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(helmet());
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/", (req, res) => {
    res.json({
      message: "Balgrim backend online",
    });
  });

  app.use("/uploads", express.static(uploadsDir));
  app.use("/api", apiRoutes);
  app.use(errorMiddleware);

  return app;
}
