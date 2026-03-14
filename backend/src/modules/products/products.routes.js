import { Router } from "express";
import { getProduct, getProducts } from "./products.controller.js";
import { asyncHandler } from "../../utils/async-handler.js";

const router = Router();

router.get("/", asyncHandler(getProducts));
router.get("/:slug", asyncHandler(getProduct));

export default router;
