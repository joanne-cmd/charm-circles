import { Router } from "express";
import { SpellController } from "../controllers/spell.controller";

const router = Router();
const spellController = new SpellController();

/**
 * POST /api/spells/build
 * Build a spell from template with parameter substitution
 * Body: { templateName: string, parameters: Record<string, string> }
 */
router.post("/build", spellController.buildSpell.bind(spellController));

/**
 * POST /api/spells/check
 * Check a spell using 'charms spell check'
 * Body: { spellYaml: string, appBin?: string, prevTxs?: string }
 */
router.post("/check", spellController.checkSpell.bind(spellController));

/**
 * POST /api/spells/prove
 * Generate unsigned PSBT using 'charms spell prove'
 * Body: {
 *   spellYaml: string,
 *   appBin?: string,
 *   prevTxs?: string,
 *   fundingUtxo?: string,
 *   fundingUtxoValue?: number,
 *   changeAddress?: string
 * }
 */
router.post("/prove", spellController.proveSpell.bind(spellController));

/**
 * POST /api/spells/build-and-check
 * Build spell from template and check it in one request
 * Body: {
 *   templateName: string,
 *   parameters: Record<string, string>,
 *   appBin?: string,
 *   prevTxs?: string
 * }
 */
router.post(
    "/build-and-check",
    spellController.buildAndCheck.bind(spellController)
);

/**
 * POST /api/spells/build-and-prove
 * Build spell from template and generate PSBT in one request
 * Body: {
 *   templateName: string,
 *   parameters: Record<string, string>,
 *   appBin?: string,
 *   prevTxs?: string,
 *   fundingUtxo?: string,
 *   fundingUtxoValue?: number,
 *   changeAddress?: string
 * }
 */
router.post(
    "/build-and-prove",
    spellController.buildAndProve.bind(spellController)
);

/**
 * GET /api/spells/templates
 * Get list of available spell templates
 */
router.get("/templates", spellController.listTemplates.bind(spellController));

export { router as spellRouter };
