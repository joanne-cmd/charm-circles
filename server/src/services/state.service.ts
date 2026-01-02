import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { AppError } from "../utils/errors";

const execAsync = promisify(exec);

export class StateService {
    private readonly projectRoot: string;

    constructor() {
        // Server is in server/ directory, project root is one level up
        this.projectRoot = join(process.cwd(), "..");
    }

    /**
     * Create initial circle state using serialize_state binary
     * @param params Circle creation parameters
     * @returns Hex-encoded CBOR serialized state
     */
    async createCircleState(params: {
        circleId: string; // hex-encoded 32-byte array
        contributionPerRound: number; // satoshis
        roundDuration: number; // seconds
        createdAt: number; // Unix timestamp
        creatorPubkey: string; // hex-encoded public key
    }): Promise<string> {
        try {
            const command = `./target/release/serialize_state "${params.circleId}" ${params.contributionPerRound} ${params.roundDuration} ${params.createdAt} "${params.creatorPubkey}"`;

            const { stdout, stderr } = await execAsync(command, {
                cwd: this.projectRoot,
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            });

            const stateHex = stdout.trim();

            if (!stateHex || stateHex.length === 0) {
                throw new Error(
                    `serialize_state returned empty output. stderr: ${stderr}`
                );
            }

            return stateHex;
        } catch (error: any) {
            const errorMessage = error.stderr || error.stdout || error.message;
            throw new AppError(
                `Failed to create circle state: ${errorMessage}`,
                500
            );
        }
    }

    /**
     * Recreate circle state from stored CircleInfo
     * This reconstructs the serialized state by calling serialize_state with the creator's info
     * then adding all additional members using update_state
     * @param circle Stored circle information
     * @returns Hex-encoded CBOR serialized state
     */
    async createCircleStateFromStored(circle: any): Promise<string> {
        try {
            // Start with the creator (first member)
            const creator = circle.members[0];
            if (!creator) {
                throw new Error("Circle has no members");
            }

            // Create initial state with creator
            let stateHex = await this.createCircleState({
                circleId: circle.circleId,
                contributionPerRound: circle.contributionPerRound,
                roundDuration: circle.roundDuration,
                createdAt: circle.createdAt,
                creatorPubkey: creator.pubkey,
            });

            // Add each additional member
            for (let i = 1; i < circle.members.length; i++) {
                const member = circle.members[i];
                stateHex = await this.addMember({
                    prevState: stateHex,
                    newMemberPubkey: member.pubkey,
                    payoutRound: member.payoutRound,
                    joinedAt: circle.createdAt, // Use circle creation time as fallback
                });
            }

            return stateHex;
        } catch (error: any) {
            const errorMessage = error.message;
            throw new AppError(
                `Failed to recreate circle state from stored data: ${errorMessage}`,
                500
            );
        }
    }

    /**
     * Add member to circle state using update_state binary
     * @param params Member addition parameters
     * @returns Hex-encoded CBOR serialized updated state
     */
    async addMember(params: {
        prevState: string; // hex-encoded previous state
        newMemberPubkey: string; // hex-encoded public key
        payoutRound: number; // round number (0-indexed)
        joinedAt: number; // Unix timestamp
    }): Promise<string> {
        try {
            const command = `./target/release/update_state add_member "${params.prevState}" "${params.newMemberPubkey}" ${params.payoutRound} ${params.joinedAt}`;

            const { stdout, stderr } = await execAsync(command, {
                cwd: this.projectRoot,
                maxBuffer: 10 * 1024 * 1024,
            });

            const updatedStateHex = stdout.trim();

            if (!updatedStateHex || updatedStateHex.length === 0) {
                throw new Error(
                    `update_state add_member returned empty output. stderr: ${stderr}`
                );
            }

            return updatedStateHex;
        } catch (error: any) {
            const errorMessage = error.stderr || error.stdout || error.message;
            throw new AppError(
                `Failed to add member to circle state: ${errorMessage}`,
                500
            );
        }
    }

    /**
     * Record contribution using update_state binary
     * @param params Contribution parameters
     * @returns Hex-encoded CBOR serialized updated state
     */
    async recordContribution(params: {
        prevState: string; // hex-encoded previous state
        contributorPubkey: string; // hex-encoded public key
        amount: number; // satoshis
        timestamp: number; // Unix timestamp
        txid: string; // hex-encoded transaction ID
    }): Promise<string> {
        try {
            const command = `./target/release/update_state record_contribution "${params.prevState}" "${params.contributorPubkey}" ${params.amount} ${params.timestamp} "${params.txid}"`;

            const { stdout, stderr } = await execAsync(command, {
                cwd: this.projectRoot,
                maxBuffer: 10 * 1024 * 1024,
            });

            const updatedStateHex = stdout.trim();

            if (!updatedStateHex || updatedStateHex.length === 0) {
                throw new Error(
                    `update_state record_contribution returned empty output. stderr: ${stderr}`
                );
            }

            return updatedStateHex;
        } catch (error: any) {
            const errorMessage = error.stderr || error.stdout || error.message;
            throw new AppError(
                `Failed to record contribution: ${errorMessage}`,
                500
            );
        }
    }
}
