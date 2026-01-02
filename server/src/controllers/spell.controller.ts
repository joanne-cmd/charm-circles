import { Request, Response, NextFunction } from "express";
import { SpellService } from "../services/spell.service";
import { StateService } from "../services/state.service";
import { BitcoinService } from "../services/bitcoin.service";
import { CircleService } from "../services/circle.service";
import { AppError } from "../utils/errors";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";

const execAsync = promisify(exec);

export class SpellController {
    private spellService: SpellService;
    private stateService: StateService;
    private bitcoinService: BitcoinService;
    private circleService: CircleService;

    constructor() {
        this.spellService = new SpellService();
        this.stateService = new StateService();
        this.bitcoinService = new BitcoinService();
        this.circleService = new CircleService();
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
     * Now includes state management integration
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
                prevTxs: providedPrevTxs,
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

            // Handle state updates based on template type
            let prevTxs = providedPrevTxs;

            console.log("[BUILD AND PROVE] templateName:", templateName);
            console.log("[BUILD AND PROVE] fundingUtxo:", fundingUtxo);
            console.log("[BUILD AND PROVE] parameters.in_utxo_0:", parameters.in_utxo_0);

            if (templateName === "create-circle") {
                // For create-circle, we need the transaction that created the funding UTXO
                // Get it from in_utxo_0 or fundingUtxo
                if (!prevTxs && (parameters.in_utxo_0 || fundingUtxo)) {
                    try {
                        const utxoToFetch = parameters.in_utxo_0 || fundingUtxo;
                        console.log("[BUILD AND PROVE] Fetching tx for UTXO:", utxoToFetch);
                        if (utxoToFetch) {
                            const { txid } =
                                this.bitcoinService.parseUtxo(utxoToFetch);
                            console.log("[BUILD AND PROVE] Parsed txid:", txid);
                            const fundingTx =
                                await this.bitcoinService.getTransaction(txid);
                            console.log("[BUILD AND PROVE] Got funding tx (length):", fundingTx?.length);
                            prevTxs = fundingTx;
                        }
                    } catch (error) {
                        console.error(
                            `[BUILD AND PROVE] Failed to fetch funding transaction:`, error
                        );
                    }
                }
                // Generate circle ID if not provided
                const circleId =
                    parameters.circle_id ||
                    crypto.randomBytes(32).toString("hex");

                // Create initial circle state
                const initialState = await this.stateService.createCircleState({
                    circleId,
                    contributionPerRound: parseInt(
                        parameters.contribution_per_round || "0"
                    ),
                    roundDuration: parseInt(parameters.round_duration || "0"),
                    createdAt:
                        parseInt(parameters.created_at_timestamp) ||
                        Math.floor(Date.now() / 1000),
                    creatorPubkey: parameters.creator_pubkey_hex || "",
                });

                // Update parameters with generated state
                parameters.circle_id = circleId;
                parameters.circle_state_serialized = initialState;

                // Calculate app_id from in_utxo_0 if provided
                if (parameters.in_utxo_0) {
                    const appIdHash = crypto
                        .createHash("sha256")
                        .update(parameters.in_utxo_0)
                        .digest("hex");
                    parameters.app_id = appIdHash;
                }

                // Get app_vk if not provided
                if (!parameters.app_vk) {
                    try {
                        const { stdout } = await execAsync("charms app vk", {
                            cwd: join(process.cwd(), ".."),
                        });
                        parameters.app_vk = stdout.trim();
                    } catch (error) {
                        console.warn("Failed to get app VK:", error);
                        // Continue without app_vk - charms spell prove might handle it
                    }
                }

                // Ensure circle_address is set
                if (!parameters.circle_address && changeAddress) {
                    parameters.circle_address = changeAddress;
                }
            } else if (templateName === "join-circle") {
                // Get previous circle state
                let prevState =
                    parameters.prev_circle_state_data ||
                    parameters.prev_circle_state_hex;

                // If state not provided, try to fetch it from circle UTXO
                if (!prevState || prevState.trim().length === 0) {
                    if (parameters.circle_utxo) {
                        // Check if it's an example circle (can't fetch real state)
                        if (parameters.circle_utxo.startsWith("example_")) {
                            throw new AppError(
                                "Cannot join example circles. These are demo circles for display only. Please create a real circle or join an existing on-chain circle.",
                                400
                            );
                        }

                        // Check if we need to load from local storage by circleId
                        // Try to parse as UTXO first
                        let storedCircle = null;
                        try {
                            const { txid: parsedTxid } = this.bitcoinService.parseUtxo(parameters.circle_utxo);
                            // Try to find in storage by checking all circles
                            const allCircles = await this.circleService.loadStoredCircles();
                            storedCircle = allCircles.find(c => c.utxo === parameters.circle_utxo);
                        } catch {
                            // Not a valid UTXO format, ignore
                        }

                        if (storedCircle) {
                            console.log("[JOIN CIRCLE] Loading state for stored circle:", storedCircle.circleId);

                            // Recreate the state from stored circle
                            prevState = await this.stateService.createCircleStateFromStored(storedCircle);
                            console.log("[JOIN CIRCLE] Loaded state from storage, length:", prevState.length);

                            // Use the stored transaction if available
                            if ((storedCircle as any).transactionHex && !prevTxs) {
                                prevTxs = (storedCircle as any).transactionHex;
                                console.log("[JOIN CIRCLE] Using stored transaction, length:", prevTxs.length);
                            }
                        } else {
                            // Try to extract state from a real Bitcoin UTXO
                            try {
                                const extractedState =
                                    await this.circleService.getCircleStateHex(
                                        parameters.circle_utxo
                                    );

                                if (extractedState && extractedState.length > 0) {
                                    prevState = extractedState;
                                } else {
                                    throw new AppError(
                                        `Could not extract circle state from UTXO ${parameters.circle_utxo}. The circle may not exist on-chain yet, or the state extraction failed. Please ensure the circle transaction is confirmed.`,
                                        400
                                    );
                                }
                            } catch (error: any) {
                                if (error instanceof AppError) {
                                    throw error;
                                }
                                throw new AppError(
                                    `Failed to fetch circle state from UTXO ${parameters.circle_utxo}: ${error.message}`,
                                    500
                                );
                            }
                        }
                    } else {
                        throw new AppError(
                            "Previous circle state is required for join-circle. Please provide prev_circle_state_data or circle_utxo.",
                            400
                        );
                    }
                }

                // Update state with new member
                const updatedState = await this.stateService.addMember({
                    prevState,
                    newMemberPubkey: parameters.new_member_pubkey_hex || "",
                    payoutRound: parseInt(parameters.payout_round || "0"),
                    joinedAt:
                        parseInt(parameters.joined_at_timestamp) ||
                        Math.floor(Date.now() / 1000),
                });

                // Update parameters with new state
                parameters.updated_circle_state_data = updatedState;
                parameters.updated_circle_state_hex = updatedState;
                parameters.prev_circle_state_data = prevState; // Set previous state

                // Get app_vk if not provided
                if (!parameters.app_vk) {
                    try {
                        const { stdout } = await execAsync("charms app vk", {
                            cwd: join(process.cwd(), ".."),
                        });
                        parameters.app_vk = stdout.trim();
                    } catch (error) {
                        console.warn("Failed to get app VK:", error);
                    }
                }

                // Get app_vk and app_id if not provided
                if (!parameters.app_id && parameters.circle_utxo) {
                    // Calculate app_id from circle_utxo
                    const appIdHash = crypto
                        .createHash("sha256")
                        .update(parameters.circle_utxo)
                        .digest("hex");
                    parameters.app_id = appIdHash;
                }

                // Get previous transaction for the circle UTXO
                if (parameters.circle_utxo && !prevTxs) {
                    try {
                        const { txid: circleTxid } = this.bitcoinService.parseUtxo(
                            parameters.circle_utxo
                        );
                        const circleTx =
                            await this.bitcoinService.getTransaction(circleTxid);
                        prevTxs = circleTx;
                        console.log("[JOIN CIRCLE] Fetched circle transaction, length:", circleTx?.length || 0);
                    } catch (error) {
                        console.warn(
                            `Failed to fetch circle transaction: ${error}. Continuing without it.`
                        );
                    }
                }
            } else if (templateName === "contribute") {
                // Get previous circle state
                const prevState =
                    parameters.prev_circle_state_data ||
                    parameters.prev_circle_state_hex;

                if (!prevState) {
                    throw new AppError(
                        "Previous circle state is required for contribute",
                        400
                    );
                }

                // Record contribution
                const updatedState = await this.stateService.recordContribution(
                    {
                        prevState,
                        contributorPubkey:
                            parameters.contributor_pubkey_hex || "",
                        amount: parseInt(parameters.contribution_amount || "0"),
                        timestamp:
                            parseInt(parameters.contribution_timestamp) ||
                            Math.floor(Date.now() / 1000),
                        txid: parameters.txid_hex || "",
                    }
                );

                // Update parameters with new state
                parameters.updated_circle_state_data = updatedState;
                parameters.updated_circle_state_hex = updatedState;

                // Get previous transactions if UTXOs are provided
                if (
                    parameters.circle_utxo &&
                    parameters.contribution_utxo &&
                    !prevTxs
                ) {
                    try {
                        const circleUtxo = this.bitcoinService.parseUtxo(
                            parameters.circle_utxo
                        );
                        const contribUtxo = this.bitcoinService.parseUtxo(
                            parameters.contribution_utxo
                        );

                        const [circleTx, contribTx] = await Promise.all([
                            this.bitcoinService.getTransaction(circleUtxo.txid),
                            this.bitcoinService.getTransaction(
                                contribUtxo.txid
                            ),
                        ]);

                        // Join transactions with comma (as required by charms spell check)
                        prevTxs = `${circleTx},${contribTx}`;
                    } catch (error) {
                        console.warn(
                            `Failed to fetch transactions: ${error}. Continuing without them.`
                        );
                    }
                }
            }

            // Build spell from template with updated parameters
            console.log("[BUILD AND PROVE] Building spell with parameters:", Object.keys(parameters));
            console.log("[BUILD AND PROVE] prev_circle_state_data length:", parameters.prev_circle_state_data?.length || 0);
            console.log("[BUILD AND PROVE] updated_circle_state_data length:", parameters.updated_circle_state_data?.length || 0);
            console.log("[BUILD AND PROVE] app_vk:", parameters.app_vk?.substring(0, 20) || "not set");
            console.log("[BUILD AND PROVE] app_id:", parameters.app_id?.substring(0, 20) || "not set");

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

            // NOTE: charms spell prove submits to the Charms network automatically
            // We don't need to broadcast via bitcoin-cli
            // The transactions are Charms covenant transactions that can't be broadcast to regular Bitcoin

            // Extract transaction info for logging
            let txid = null;
            if (proveResult.transactions && proveResult.transactions.length > 0) {
                console.log("[BUILD AND PROVE] Generated", proveResult.transactions.length, "transaction(s)");
                console.log("[BUILD AND PROVE] Transaction submitted to Charms network via spell prove");

                // Note: Charms doesn't return a txid the way Bitcoin does
                // The transaction is submitted to the Charms network, not regular Bitcoin
                // Success is indicated by no PROVE credits error

                // For create-circle, save to local storage for demo purposes
                if (templateName === "create-circle" && parameters.circle_id) {
                    try {
                        const circleInfo = {
                            utxo: `charms:${parameters.circle_id}`, // Placeholder UTXO for Charms network
                            circleId: parameters.circle_id,
                            memberCount: 1, // Creator
                            totalRounds: parameters.max_members ? parseInt(parameters.max_members) : 5,
                            currentRound: 0,
                            contributionPerRound: parseInt(parameters.contribution_per_round || "0"),
                            currentPool: 0,
                            isComplete: false,
                            createdAt: parseInt(parameters.created_at_timestamp) || Math.floor(Date.now() / 1000),
                            roundStartedAt: parseInt(parameters.created_at_timestamp) || Math.floor(Date.now() / 1000),
                            roundDuration: parseInt(parameters.round_duration || "0"),
                            currentPayoutIndex: 0,
                            members: [{
                                pubkey: parameters.creator_pubkey_hex || "",
                                hasReceivedPayout: false,
                                payoutRound: 0,
                            }],
                            purpose: parameters.purpose || "Community Circle",
                            frequency: parameters.round_duration === "604800" ? "weekly" as const : "monthly" as const,
                        };

                        await this.circleService.saveCircle(circleInfo);
                        console.log("[BUILD AND PROVE] Saved circle to local storage");
                    } catch (saveError: any) {
                        console.error("[BUILD AND PROVE] Failed to save circle:", saveError.message);
                        // Don't fail the request if saving fails
                    }
                }
            }

            res.json({
                success: true,
                data: {
                    spellYaml,
                    proveResult,
                    txid, // Will be null - Charms handles submission internally
                    circleId: templateName === "create-circle" ? parameters.circle_id : undefined,
                    message: proveResult.transactions && proveResult.transactions.length > 0
                        ? "Transaction generated and submitted to Charms network"
                        : undefined,
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
