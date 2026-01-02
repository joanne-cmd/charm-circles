import { Request, Response, NextFunction } from "express";
import { CircleService } from "../services/circle.service";
import { AppError } from "../utils/errors";

export class CircleController {
    private circleService: CircleService;

    constructor() {
        this.circleService = new CircleService();
    }

    /**
     * GET /api/circles
     * Discover all active circles
     */
    async discoverCircles(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { appVk } = req.query;

            const circles = await this.circleService.discoverCircles(
                appVk as string | undefined
            );

            res.json({
                success: true,
                data: {
                    circles,
                    count: circles.length,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/circles/:utxo
     * Get circle details by UTXO
     */
    async getCircle(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { utxo } = req.params;

            if (!utxo || !utxo.includes(":")) {
                throw new AppError(
                    "Invalid UTXO format. Expected: txid:index",
                    400
                );
            }

            const circle = await this.circleService.getCircleByUtxo(utxo);

            if (!circle) {
                throw new AppError("Circle not found", 404);
            }

            res.json({
                success: true,
                data: {
                    circle,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/circles/utxos/:address
     * Get UTXOs for an address (for funding transactions)
     */
    async getUtxos(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { address } = req.params;

            if (!address) {
                throw new AppError("Address is required", 400);
            }

            // Import BitcoinService
            const { BitcoinService } = await import(
                "../services/bitcoin.service"
            );
            const bitcoinService = new BitcoinService();

            const utxos = await bitcoinService.getUnspentOutputs(address);

            res.json({
                success: true,
                data: {
                    utxos,
                    count: utxos.length,
                },
            });
        } catch (error) {
            next(error);
        }
    }
}
