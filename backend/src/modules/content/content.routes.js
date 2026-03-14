import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { getContentBlocks } from "./content.controller.js";

const router = Router();

router.get("/", asyncHandler(getContentBlocks));

export default router;
