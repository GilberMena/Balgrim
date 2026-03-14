import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { createCartItem, deleteCartItem, getCurrentCart, patchCartItem } from "./cart.controller.js";

const router = Router();

router.get("/", asyncHandler(getCurrentCart));
router.post("/items", asyncHandler(createCartItem));
router.patch("/items/:itemId", asyncHandler(patchCartItem));
router.delete("/items/:itemId", asyncHandler(deleteCartItem));

export default router;
