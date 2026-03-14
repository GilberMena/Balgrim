import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createInventoryAdjustment,
  deleteAdminProduct,
  deleteContentBlock,
  deleteCoupon,
  getAdminOrders,
  getAdminProducts,
  getAuditLogs,
  getContentBlocks,
  getCoupons,
  getCustomers,
  getDashboard,
  getInventory,
  getStoreSettingsAdmin,
  saveAdminProduct,
  saveContentBlock,
  saveCoupon,
  updateAdminOrder,
  updateStoreSettingsAdmin,
} from "./admin.controller.js";

const router = Router();

router.use(requireAdmin);

router.get("/dashboard", asyncHandler(getDashboard));
router.get("/products", asyncHandler(getAdminProducts));
router.post("/products", asyncHandler(saveAdminProduct));
router.delete("/products/:id", asyncHandler(deleteAdminProduct));

router.get("/orders", asyncHandler(getAdminOrders));
router.patch("/orders/:id", asyncHandler(updateAdminOrder));

router.get("/customers", asyncHandler(getCustomers));

router.get("/inventory", asyncHandler(getInventory));
router.post("/inventory/adjustments", asyncHandler(createInventoryAdjustment));

router.get("/coupons", asyncHandler(getCoupons));
router.post("/coupons", asyncHandler(saveCoupon));
router.delete("/coupons/:id", asyncHandler(deleteCoupon));

router.get("/content", asyncHandler(getContentBlocks));
router.post("/content", asyncHandler(saveContentBlock));
router.delete("/content/:id", asyncHandler(deleteContentBlock));

router.get("/audit-logs", asyncHandler(getAuditLogs));

router.get("/settings", asyncHandler(getStoreSettingsAdmin));
router.put("/settings", asyncHandler(updateStoreSettingsAdmin));

export default router;
