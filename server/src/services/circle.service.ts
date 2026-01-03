import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { promises as fs } from "fs";
import { AppError } from "../utils/errors";
import cbor from "cbor";

const execAsync = promisify(exec);

interface CircleInfo {
    utxo: string; // txid:index
    circleId: string; // hex-encoded
    memberCount: number;
    totalRounds: number;
    currentRound: number;
    contributionPerRound: number; // satoshis
    currentPool: number; // satoshis
    isComplete: boolean;
    createdAt: number; // Unix timestamp
    roundStartedAt: number;
    roundDuration: number; // seconds
    currentPayoutIndex: number;
    members: Array<{
        pubkey: string; // hex-encoded
        hasReceivedPayout: boolean;
        payoutRound: number;
    }>;
    // Optional display fields
    purpose?: string;
    frequency?: "weekly" | "monthly";
}

interface CircleStateData {
    circle_id: number[]; // [u8; 32]
    members: Array<{
        pubkey: number[]; // Vec<u8>
        contribution_amount: number;
        contribution_history: Array<{
            round: number;
            amount: number;
            timestamp: number;
            txid: number[]; // [u8; 32]
        }>;
        has_received_payout: boolean;
        payout_round: number;
        joined_at: number;
    }>;
    current_round: number;
    total_rounds: number;
    contribution_per_round: number;
    current_payout_index: number;
    current_pool: number;
    created_at: number;
    round_started_at: number;
    round_duration: number;
    is_complete: boolean;
    prev_state_hash: number[]; // [u8; 32]
}

export class CircleService {
    private readonly appVk: string | null = null;
    private readonly storageFile = join(__dirname, "../../data/circles.json");

    constructor() {
        // App VK can be cached or fetched on demand
        // For now, we'll fetch it when needed
        this.ensureStorageExists();
    }

    /**
     * Ensure storage file exists
     */
    private async ensureStorageExists(): Promise<void> {
        try {
            await fs.access(this.storageFile);
        } catch {
            // File doesn't exist, create it
            await fs.mkdir(join(__dirname, "../../data"), { recursive: true });
            await fs.writeFile(this.storageFile, JSON.stringify({ circles: [] }, null, 2));
        }
    }

    /**
     * Save a circle to local storage
     */
    async saveCircle(circle: CircleInfo): Promise<void> {
        try {
            const data = await fs.readFile(this.storageFile, "utf-8");
            const storage = JSON.parse(data);

            // Check if circle already exists (by circleId)
            const existingIndex = storage.circles.findIndex(
                (c: CircleInfo) => c.circleId === circle.circleId
            );

            if (existingIndex >= 0) {
                storage.circles[existingIndex] = circle;
                console.log("[CIRCLE STORAGE] Updated circle:", circle.circleId);
            } else{
                storage.circles.push(circle);
                console.log("[CIRCLE STORAGE] Added new circle:", circle.circleId);
            }

            await fs.writeFile(this.storageFile, JSON.stringify(storage, null, 2));
        } catch (error: any) {
            console.error("[CIRCLE STORAGE] Failed to save circle:", error.message);
        }
    }

    /**
     * Add member to circle
     */
    async addMemberToCircle(
        circleId: string,
        pubkey: string,
        payoutRound: number
    ): Promise<void> {
        try {
            const data = await fs.readFile(this.storageFile, "utf-8");
            const storage = JSON.parse(data);

            const circleIndex = storage.circles.findIndex(
                (c: CircleInfo) => c.circleId === circleId
            );

            if (circleIndex < 0) {
                throw new Error(`Circle ${circleId} not found`);
            }

            const circle = storage.circles[circleIndex];

            // Add new member
            circle.members.push({
                pubkey,
                hasReceivedPayout: false,
                payoutRound,
            });

            // Update member count
            circle.memberCount = circle.members.length;

            // Save updated circle
            storage.circles[circleIndex] = circle;
            await fs.writeFile(this.storageFile, JSON.stringify(storage, null, 2));

            console.log("[CIRCLE STORAGE] Added member to circle:", circleId);
        } catch (error: any) {
            console.error("[CIRCLE STORAGE] Failed to add member:", error.message);
            throw error;
        }
    }

    /**
     * Load circles from local storage
     */
    async loadStoredCircles(): Promise<CircleInfo[]> {
        try {
            const data = await fs.readFile(this.storageFile, "utf-8");
            const storage = JSON.parse(data);
            return storage.circles || [];
        } catch (error: any) {
            console.warn("[CIRCLE STORAGE] Could not load circles:", error.message);
            return [];
        }
    }

    /**
     * Get circle by ID from local storage
     */
    async getCircleById(circleId: string): Promise<CircleInfo | null> {
        const circles = await this.loadStoredCircles();
        return circles.find(c => c.circleId === circleId) || null;
    }

    /**
     * Get app verification key
     */
    private async getAppVk(): Promise<string> {
        try {
            const { stdout } = await execAsync("charms app vk", {
                cwd: join(process.cwd(), ".."),
            });
            return stdout.trim();
        } catch (error: any) {
            throw new AppError(`Failed to get app VK: ${error.message}`, 500);
        }
    }

    /**
     * Query Bitcoin for UTXOs with charm app data
     * This uses bitcoin-cli to scan for UTXOs with the app tag
     */
    async discoverCircles(appVk?: string): Promise<CircleInfo[]> {
        try {
            const vk = appVk || (await this.getAppVk());

            // Query unspent outputs
            // Note: This is a simplified approach. In production, you'd want to:
            // 1. Use a Bitcoin indexer API (like Esplora, Blockstream, etc.)
            // 2. Filter by app tag pattern: a/{app_id}/{app_vk}
            // 3. Parse charm data from outputs

            // For now, we'll use bitcoin-cli listunspent and scan for outputs
            // with charm data. This is not efficient for large networks but works for testing.

            const { stdout } = await execAsync(
                "bitcoin-cli listunspent 0 9999999 '[]' true",
                { maxBuffer: 10 * 1024 * 1024 }
            );

            const utxos = JSON.parse(stdout);
            let circles: CircleInfo[] = [];

            for (const utxo of utxos) {
                try {
                    // Get transaction details to check for charm data
                    const txInfo = await this.getTransactionWithCharmData(
                        utxo.txid,
                        utxo.vout
                    );

                    if (txInfo) {
                        const circleInfo = await this.parseCircleState(
                            `${utxo.txid}:${utxo.vout}`,
                            txInfo
                        );

                        if (circleInfo && !circleInfo.isComplete) {
                            circles.push(circleInfo);
                        }
                    }
                } catch (error) {
                    // Skip UTXOs that don't have charm data or fail to parse
                    continue;
                }
            }

            // Load locally stored circles (created via Charms network)
            const storedCircles = await this.loadStoredCircles();
            console.log("[DISCOVER] Found", storedCircles.length, "stored circles");

            // Merge real circles and stored circles, avoiding duplicates
            const allCircles = [...circles];
            const existingUtxos = new Set(circles.map((c) => c.utxo));
            const existingCircleIds = new Set(circles.map((c) => c.circleId));

            // Add stored circles (from Charms network)
            for (const stored of storedCircles) {
                if (!existingUtxos.has(stored.utxo) && !existingCircleIds.has(stored.circleId)) {
                    allCircles.push(stored);
                    existingUtxos.add(stored.utxo);
                    existingCircleIds.add(stored.circleId);
                }
            }

            return allCircles;
        } catch (error: any) {
            // On error, still return example circles for development
            console.error("Error discovering circles:", error);
            return this.getExampleCircles();
        }
    }

    /**
     * Get example circles for development/demo purposes
     */
    private getExampleCircles(): CircleInfo[] {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

        return [
            {
                utxo: "example_circle_1:0",
                circleId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3",
                memberCount: 3,
                totalRounds: 5,
                currentRound: 0,
                contributionPerRound: 100000, // 0.001 BTC
                currentPool: 0,
                isComplete: false,
                createdAt: thirtyDaysAgo,
                roundStartedAt: thirtyDaysAgo,
                roundDuration: 30 * 24 * 60 * 60, // 30 days
                currentPayoutIndex: 0,
                members: [
                    {
                        pubkey: "023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281",
                        hasReceivedPayout: false,
                        payoutRound: 0,
                    },
                    {
                        pubkey: "02ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                        hasReceivedPayout: false,
                        payoutRound: 1,
                    },
                    {
                        pubkey: "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                        hasReceivedPayout: false,
                        payoutRound: 2,
                    },
                ],
                // Additional fields for display
                purpose: "Emergency fund for our community group",
                frequency: "monthly" as const,
            } as any,
            {
                utxo: "example_circle_2:0",
                circleId: "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
                memberCount: 2,
                totalRounds: 4,
                currentRound: 0,
                contributionPerRound: 50000, // 0.0005 BTC
                currentPool: 0,
                isComplete: false,
                createdAt: thirtyDaysAgo + 86400, // 1 day later
                roundStartedAt: thirtyDaysAgo + 86400,
                roundDuration: 7 * 24 * 60 * 60, // 7 days (weekly)
                currentPayoutIndex: 0,
                members: [
                    {
                        pubkey: "023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281",
                        hasReceivedPayout: false,
                        payoutRound: 0,
                    },
                    {
                        pubkey: "02ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                        hasReceivedPayout: false,
                        payoutRound: 1,
                    },
                ],
                // Additional fields for display
                purpose: "Weekly savings challenge - build your Bitcoin stack",
                frequency: "weekly" as const,
            } as any,
        ];
    }

    /**
     * Get transaction and check if it has charm app data
     */
    private async getTransactionWithCharmData(
        txid: string,
        vout: number
    ): Promise<any> {
        try {
            // Get raw transaction
            const { stdout } = await execAsync(
                `bitcoin-cli getrawtransaction "${txid}" true`
            );

            const tx = JSON.parse(stdout);

            // Check if output has charm data
            if (tx.vout && tx.vout[vout]) {
                const output = tx.vout[vout];

                // Charm data might be in scriptPubKey or witness
                // This is a simplified check - actual implementation depends on
                // how Charms stores data in outputs

                // For now, we'll try to extract from scriptPubKey.hex or other fields
                // You may need to adjust this based on actual Charms output format
                return output;
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Parse CircleState from CBOR-encoded charm data
     */
    private async parseCircleState(
        utxo: string,
        output: any
    ): Promise<CircleInfo | null> {
        try {
            // Extract charm data from output
            // This is a placeholder - actual extraction depends on Charms format
            // The data might be in scriptPubKey, witness, or a separate field

            // For now, assume we have a way to get the CBOR-encoded data
            // In practice, you'd extract this from the transaction output structure
            const charmDataHex = this.extractCharmData(output);

            if (!charmDataHex) {
                return null;
            }

            // Decode CBOR
            const charmDataBuffer = Buffer.from(charmDataHex, "hex");
            const decoded = cbor.decode(charmDataBuffer);

            // Parse CircleState structure
            const state = decoded as CircleStateData;

            return {
                utxo,
                circleId: Buffer.from(state.circle_id).toString("hex"),
                memberCount: state.members.length,
                totalRounds: state.total_rounds,
                currentRound: state.current_round,
                contributionPerRound: state.contribution_per_round,
                currentPool: state.current_pool,
                isComplete: state.is_complete,
                createdAt: state.created_at,
                roundStartedAt: state.round_started_at,
                roundDuration: state.round_duration,
                currentPayoutIndex: state.current_payout_index,
                members: state.members.map((m) => ({
                    pubkey: Buffer.from(m.pubkey).toString("hex"),
                    hasReceivedPayout: m.has_received_payout,
                    payoutRound: m.payout_round,
                })),
            };
        } catch (error) {
            console.error(`Failed to parse circle state for ${utxo}:`, error);
            return null;
        }
    }

    /**
     * Extract charm data from transaction output
     * This is a placeholder - adjust based on actual Charms output format
     */
    private extractCharmData(output: any): string | null {
        // TODO: Implement actual extraction based on Charms output format
        // This might involve:
        // 1. Parsing scriptPubKey for OP_RETURN data
        // 2. Reading from witness data
        // 3. Using a Charms-specific indexer API

        // For now, return null as placeholder
        // In production, you'd parse the actual output structure
        return null;
    }

    /**
     * Get circle details by UTXO
     */
    async getCircleByUtxo(utxo: string): Promise<CircleInfo | null> {
        try {
            // First, check if this circle exists in local storage
            const circles = await this.loadStoredCircles();
            const storedCircle = circles.find(c => c.utxo === utxo);

            if (storedCircle) {
                console.log("[CIRCLE SERVICE] Found circle in local storage:", utxo);
                return storedCircle;
            }

            // If not found locally, try to fetch from blockchain
            const [txid, voutStr] = utxo.split(":");
            const vout = parseInt(voutStr, 10);

            const output = await this.getTransactionWithCharmData(txid, vout);

            if (!output) {
                return null;
            }

            return await this.parseCircleState(utxo, output);
        } catch (error: any) {
            throw new AppError(`Failed to get circle: ${error.message}`, 500);
        }
    }

    /**
     * Extract circle state hex from UTXO
     * Uses the get-circle-state.sh script as a helper
     */
    async getCircleStateHex(utxo: string): Promise<string | null> {
        try {
            // Check if it's an example circle
            if (utxo.startsWith("example_")) {
                return null; // Example circles don't have real state
            }

            // Try to use the helper script
            const { stdout } = await execAsync(
                `./scripts/get-circle-state.sh "${utxo}"`,
                {
                    cwd: join(process.cwd(), ".."),
                    maxBuffer: 10 * 1024 * 1024,
                }
            );

            // The script outputs the state hex
            const stateHex = stdout.trim();
            if (stateHex && stateHex.length > 0) {
                return stateHex;
            }

            return null;
        } catch (error) {
            // If script fails, return null (will trigger error in controller)
            console.warn(`Failed to get circle state for ${utxo}:`, error);
            return null;
        }
    }
}
