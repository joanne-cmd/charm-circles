import { Request, Response, NextFunction } from "express";
import { SpellService } from "../services/spell.service";
import { AppError } from "../utils/errors";

export class SpellController {
    private spellService: SpellService;

    constructor() {
        this.spellService = new SpellService();
    }

    /**
     * Build spell from template with parameter substitution
     */
    async buildSpell(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { templateName, parameters } = req.body;

            if (!templateName) {
                throw new AppError("templateName is required", 400);
            }

            if (!parameters || typeof parameters !== "object") {
                throw new AppError("parameters must be an object", 400);
            }

            const spellYaml = await this.spellService.buildSpellFromTemplate(
                templateName,
                parameters
            );

            res.json({
                success: true,
                data: {
                    spellYaml,
                    templateName,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Check a spell using 'charms spell check'
     */
    async checkSpell(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { spellYaml, appBin, prevTxs } = req.body;

            if (!spellYaml) {
                throw new AppError("spellYaml is required", 400);
            }

            const result = await this.spellService.checkSpell({
                spellYaml,
                appBin,
                prevTxs,
            });

            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generate unsigned PSBT using 'charms spell prove'
     */
    async proveSpell(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const {
                spellYaml,
                appBin,
                prevTxs,
                fundingUtxo,
                fundingUtxoValue,
                changeAddress,
            } = req.body;

            if (!spellYaml) {
                throw new AppError("spellYaml is required", 400);
            }

            const result = await this.spellService.proveSpell({
                spellYaml,
                appBin,
                prevTxs,
                fundingUtxo,
                fundingUtxoValue,
                changeAddress,
            });

            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Build spell from template and check it
     */
    async buildAndCheck(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { templateName, parameters, appBin, prevTxs } = req.body;

            if (!templateName) {
                throw new AppError("templateName is required", 400);
            }

            if (!parameters || typeof parameters !== "object") {
                throw new AppError("parameters must be an object", 400);
            }

            // Build spell
            const spellYaml = await this.spellService.buildSpellFromTemplate(
                templateName,
                parameters
            );

            // Check spell
            const checkResult = await this.spellService.checkSpell({
                spellYaml,
                appBin,
                prevTxs,
            });

            res.json({
                success: true,
                data: {
                    spellYaml,
                    checkResult,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Build spell from template and generate PSBT
     */
    async buildAndProve(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const {
                templateName,
                parameters,
                appBin,
                prevTxs,
                fundingUtxo,
                fundingUtxoValue,
                changeAddress,
            } = req.body;

            if (!templateName) {
                throw new AppError("templateName is required", 400);
            }

            if (!parameters || typeof parameters !== "object") {
                throw new AppError("parameters must be an object", 400);
            }

            // Build spell
            const spellYaml = await this.spellService.buildSpellFromTemplate(
                templateName,
                parameters
            );

            // Generate PSBT
            const proveResult = await this.spellService.proveSpell({
                spellYaml,
                appBin,
                prevTxs,
                fundingUtxo,
                fundingUtxoValue,
                changeAddress,
            });

            res.json({
                success: true,
                data: {
                    spellYaml,
                    proveResult,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * List available spell templates
     */
    async listTemplates(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const templates = await this.spellService.listTemplates();

            res.json({
                success: true,
                data: {
                    templates,
                },
            });
        } catch (error) {
            next(error);
        }
    }
}
