/**
 * JoinCircleService - Handles joining a circle flow
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface JoinCircleParams {
    circleId: string;
    joinerPubkey: string;
    fundingUtxo: string;
    changeAddress: string;
}

export interface JoinCircleResult {
    transaction: string;
    spellYaml: string;
    newMemberCount: number;
}

export class JoinCircleService {
    /**
     * Join a circle using the simplified backend endpoint
     */
    async joinCircle(params: JoinCircleParams): Promise<JoinCircleResult> {
        const response = await fetch(
            `${API_BASE_URL}/api/circles/${params.circleId}/join`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    joinerPubkey: params.joinerPubkey,
                    fundingUtxo: params.fundingUtxo,
                    changeAddress: params.changeAddress,
                }),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                error.error || error.message || "Failed to join circle"
            );
        }

        const data = await response.json();
        return {
            transaction: data.data.transaction,
            spellYaml: data.data.spellYaml,
            newMemberCount: data.data.newMemberCount,
        };
    }
}
