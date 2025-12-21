import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
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

    constructor() {
        // App VK can be cached or fetched on demand
        // For now, we'll fetch it when needed
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
            const circles: CircleInfo[] = [];

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

            return circles;
        } catch (error: any) {
            throw new AppError(
                `Failed to discover circles: ${error.message}`,
                500
            );
        }
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
}
