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
 * GET /api/circles/utxos/:address
 * Get UTXOs for an address (for funding transactions)
 * NOTE: Must come before /:utxo route to avoid route conflicts
 */
router.get("/utxos/:address", circleController.getUtxos.bind(circleController));

/**
 * GET /api/circles/:utxo
 * Get circle details by UTXO (format: txid:index)
 */
router.get("/:utxo", circleController.getCircle.bind(circleController));

/**
 * POST /api/circles/:circleId/join
 * Join an existing circle
 */
router.post("/:circleId/join", circleController.joinCircle.bind(circleController));

export { router as circleRouter };
