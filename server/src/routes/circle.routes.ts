import { Router } from "express";
import { CircleController } from "../controllers/circle.controller";

const router = Router();
const circleController = new CircleController();

/**
 * GET /api/circles
 * Discover all active circles
 */
router.get("/", circleController.discoverCircles.bind(circleController));

/**
 * GET /api/circles/:utxo
 * Get circle details by UTXO (format: txid:index)
 */
router.get("/:utxo", circleController.getCircle.bind(circleController));

export { router as circleRouter };
