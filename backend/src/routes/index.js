import { Router } from "express";
import adminRoutes from "../modules/admin/admin.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import cartRoutes from "../modules/cart/cart.routes.js";
import contentRoutes from "../modules/content/content.routes.js";
import healthRoutes from "../modules/health/health.routes.js";
import ordersRoutes from "../modules/orders/orders.routes.js";
import paymentsRoutes from "../modules/payments/payments.routes.js";
import productsRoutes from "../modules/products/products.routes.js";
import settingsRoutes from "../modules/settings/settings.routes.js";
import uploadsRoutes from "../modules/uploads/uploads.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/products", productsRoutes);
router.use("/content", contentRoutes);
router.use("/settings", settingsRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", ordersRoutes);
router.use("/payments", paymentsRoutes);
router.use("/uploads", uploadsRoutes);
router.use("/admin", adminRoutes);

export default router;
