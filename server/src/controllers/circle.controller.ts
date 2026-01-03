import { Request, Response, NextFunction } from "express";
import { CircleService } from "../services/circle.service";
import { SpellService } from "../services/spell.service";
import { StateService } from "../services/state.service";
import { BitcoinService } from "../services/bitcoin.service";
import { AppError } from "../utils/errors";

export class CircleController {
    private circleService: CircleService;
    private spellService: SpellService;
    private stateService: StateService;
    private bitcoinService: BitcoinService;

    constructor() {
        this.circleService = new CircleService();
        this.spellService = new SpellService();
        this.stateService = new StateService();
        this.bitcoinService = new BitcoinService();
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

    /**
     * POST /api/circles/:circleId/join
     * Join an existing circle
     */
    async joinCircle(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { circleId } = req.params;
            const { joinerPubkey, fundingUtxo, changeAddress } = req.body;

            console.log("[JOIN CIRCLE] Request received:", {
                circleId,
                joinerPubkey,
                fundingUtxo,
                changeAddress,
            });

            // Validate inputs
            if (!circleId) {
                throw new AppError("circleId is required", 400);
            }
            if (!joinerPubkey) {
                throw new AppError("joinerPubkey is required", 400);
            }
            if (!fundingUtxo) {
                throw new AppError("fundingUtxo is required", 400);
            }
            if (!changeAddress) {
                throw new AppError("changeAddress is required", 400);
            }

            // Get circle by ID
            const circle = await this.circleService.getCircleById(circleId);
            if (!circle) {
                throw new AppError("Circle not found", 404);
            }

            console.log("[JOIN CIRCLE] Found circle:", {
                purpose: circle.purpose,
                memberCount: circle.memberCount,
                maxMembers: circle.totalRounds,
            });

            // Check if circle is full
            if (circle.memberCount >= circle.totalRounds) {
                throw new AppError("Circle is full", 400);
            }

            // Check if member already exists
            const memberExists = circle.members?.some(
                (m) => m.pubkey === joinerPubkey
            );
            if (memberExists) {
                throw new AppError("Member already in circle", 400);
            }

            // Get previous circle state
            const prevCircleStateData =
                await this.stateService.getCircleState(circle.utxo);

            console.log("[JOIN CIRCLE] Previous state length:", prevCircleStateData?.length);

            // Calculate payout round (next available round)
            const payoutRound = circle.memberCount; // 0-indexed

            // Update state: add new member
            const joinedAtTimestamp = Math.floor(Date.now() / 1000);
            const updatedCircleStateData =
                await this.stateService.addMemberToState(
                    prevCircleStateData,
                    joinerPubkey,
                    payoutRound,
                    joinedAtTimestamp
                );

            console.log("[JOIN CIRCLE] Updated state length:", updatedCircleStateData.length);

            // Get previous transaction for circle UTXO
            let prevTxs = "";

            // Check if circle has stored commit transaction hex
            if ((circle as any).commitTxHex) {
                prevTxs = (circle as any).commitTxHex;
                console.log("[JOIN CIRCLE] Using stored commit transaction hex");
            } else if (!circle.utxo.startsWith("charms:")) {
                // Try to fetch from Bitcoin blockchain
                try {
                    const { txid } = this.bitcoinService.parseUtxo(circle.utxo);
                    prevTxs = await this.bitcoinService.getTransaction(txid);
                    console.log("[JOIN CIRCLE] Fetched transaction from Bitcoin");
                } catch (error: any) {
                    console.warn("[JOIN CIRCLE] Failed to fetch transaction from Bitcoin:", error.message);
                    // Continue with empty prevTxs - spell prove might work in mock mode
                }
            } else {
                // For old-style charms: prefix circles
                console.log("[JOIN CIRCLE] Old-style circle, no previous transaction needed");
            }

            // Import modules at the beginning
            const path = await import("path");
            const fs = await import("fs");
            const crypto = await import("crypto");
            const { exec } = await import("child_process");
            const { promisify } = await import("util");
            const execAsync = promisify(exec);

            // Calculate app_id from circle UTXO
            const appId = crypto
                .createHash("sha256")
                .update(circle.utxo)
                .digest("hex");

            // Get app verification key
            const { stdout: appVk } = await execAsync("charms app vk", {
                cwd: path.join(process.cwd(), ".."), // Run from project root
            });

            // Build join-circle spell
            const spellParams = {
                circle_utxo: circle.utxo,
                prev_circle_state_data: prevCircleStateData,
                updated_circle_state_data: updatedCircleStateData,
                circle_address: changeAddress,
                new_member_pubkey_hex: joinerPubkey,
                payout_round: payoutRound.toString(),
                joined_at_timestamp: joinedAtTimestamp.toString(),
                app_id: appId,
                app_vk: appVk.trim(),
            };

            console.log("[JOIN CIRCLE] Building spell with params");

            const spellYaml = await this.spellService.buildSpellFromTemplate(
                "join-circle",
                spellParams
            );

            console.log("[JOIN CIRCLE] Proving spell...");
            const tempDir = path.join(process.cwd(), "server", "temp");

            // Ensure temp directory exists
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const tempSpellPath = path.join(
                tempDir,
                `spell-${Date.now()}.yaml`
            );
            fs.writeFileSync(tempSpellPath, spellYaml);

            // Get app binary path (use the pre-built WASM file)
            const appBin = path.join(process.cwd(), "..", "target", "wasm32-wasip1", "release", "charmcircle.wasm");

            // Check if app binary exists
            if (!fs.existsSync(appBin)) {
                throw new AppError(
                    `App binary not found at ${appBin}. Run 'cargo build --release --target wasm32-wasip1' in the project root.`,
                    500
                );
            }

            // Parse funding UTXO
            const [fundingTxid, fundingVoutStr] = fundingUtxo.split(":");
            const fundingVout = parseInt(fundingVoutStr, 10);

            // Get funding UTXO value
            const fundingUtxoValue = await this.bitcoinService.getUtxoValue(fundingTxid, fundingVout);

            // Prove spell
            const proveCommand = `charms spell prove --spell "${tempSpellPath}" --prev-txs="${prevTxs}" --app-bins="${appBin}" --funding-utxo="${fundingUtxo}" --funding-utxo-value="${fundingUtxoValue}" --change-address="${changeAddress}"`;
            console.log("[JOIN CIRCLE] Running prove command");

            const { stdout: proveOutput } = await execAsync(proveCommand, {
                maxBuffer: 10 * 1024 * 1024,
            });

            console.log("[JOIN CIRCLE] Spell proved successfully");

            // Parse JSON output from charms spell prove
            let proveResult: any;
            try {
                // The output is a JSON array
                proveResult = JSON.parse(proveOutput);
            } catch (parseError) {
                console.error("[JOIN CIRCLE] Failed to parse prove output as JSON:", parseError);
                throw new AppError(
                    "Failed to parse proof output",
                    500
                );
            }

            // Extract the transaction hex from the result
            // The result is an array with bitcoin transaction objects
            let transaction = null;
            if (proveResult && Array.isArray(proveResult) && proveResult.length > 0) {
                // The second transaction in the array is the spell transaction
                const spellTx = proveResult[1];
                if (spellTx && spellTx.bitcoin) {
                    transaction = spellTx.bitcoin;
                    console.log("[JOIN CIRCLE] Extracted transaction hex (length):", transaction.length);
                }
            }

            if (!transaction) {
                console.error("[JOIN CIRCLE] Prove result structure:", JSON.stringify(proveResult).substring(0, 500));
                throw new AppError(
                    "Failed to extract transaction from proof",
                    500
                );
            }

            // Update local storage with new member
            await this.circleService.addMemberToCircle(
                circleId,
                joinerPubkey,
                payoutRound
            );

            res.json({
                success: true,
                data: {
                    transaction,
                    spellYaml,
                    circleId,
                    newMemberCount: circle.memberCount + 1,
                },
            });
        } catch (error) {
            console.error("[JOIN CIRCLE] Error:", error);
            next(error);
        }
    }
}
