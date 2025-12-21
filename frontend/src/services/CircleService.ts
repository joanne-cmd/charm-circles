/**
 * CircleService - API client for circle discovery and management
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface CircleInfo {
    utxo: string;
    circleId: string;
    memberCount: number;
    totalRounds: number;
    currentRound: number;
    contributionPerRound: number;
    currentPool: number;
    isComplete: boolean;
    createdAt: number;
    roundStartedAt: number;
    roundDuration: number;
    currentPayoutIndex: number;
    members: Array<{
        pubkey: string;
        hasReceivedPayout: boolean;
        payoutRound: number;
    }>;
}

export interface DiscoverCirclesResponse {
    success: boolean;
    data: {
        circles: CircleInfo[];
        count: number;
    };
}

export interface GetCircleResponse {
    success: boolean;
    data: {
        circle: CircleInfo;
    };
}

export class CircleService {
    /**
     * Discover all active circles
     */
    async discoverCircles(appVk?: string): Promise<CircleInfo[]> {
        const url = new URL(`${API_BASE_URL}/api/circles`);
        if (appVk) {
            url.searchParams.set("appVk", appVk);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                error.error?.message || "Failed to discover circles"
            );
        }

        const data: DiscoverCirclesResponse = await response.json();
        return data.data.circles;
    }

    /**
     * Get circle details by UTXO
     */
    async getCircle(utxo: string): Promise<CircleInfo> {
        const response = await fetch(
            `${API_BASE_URL}/api/circles/${encodeURIComponent(utxo)}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || "Failed to get circle");
        }

        const data: GetCircleResponse = await response.json();
        return data.data.circle;
    }

    /**
     * Format contribution amount for display
     */
    formatContribution(satoshis: number): string {
        const btc = satoshis / 100_000_000;
        if (btc < 0.001) {
            return `${satoshis} sats`;
        }
        return `${btc.toFixed(8).replace(/\.?0+$/, "")} BTC`;
    }

    /**
     * Calculate time remaining in current round
     */
    getRoundTimeRemaining(circle: CircleInfo): number {
        const elapsed = Date.now() / 1000 - circle.roundStartedAt;
        return Math.max(0, circle.roundDuration - elapsed);
    }

    /**
     * Format time remaining
     */
    formatTimeRemaining(seconds: number): string {
        if (seconds < 60) {
            return `${Math.floor(seconds)}s`;
        }
        if (seconds < 3600) {
            return `${Math.floor(seconds / 60)}m`;
        }
        if (seconds < 86400) {
            return `${Math.floor(seconds / 3600)}h`;
        }
        return `${Math.floor(seconds / 86400)}d`;
    }
}
