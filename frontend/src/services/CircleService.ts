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
    // Optional fields for display
    purpose?: string;
    frequency?: "weekly" | "monthly";
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

        try {
            const response = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                // Try to parse error response
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const error = await response.json();
                    errorMessage = error.error?.message || errorMessage;
                } catch {
                    // If JSON parsing fails, use status text
                }

                // Provide helpful error message
                if (response.status === 0 || response.status >= 500) {
                    throw new Error(
                        `Backend server is not running. Please start it with: ./scripts/start-backend.sh\n\nOriginal error: ${errorMessage}`
                    );
                }

                throw new Error(errorMessage);
            }

            const data: DiscoverCirclesResponse = await response.json();
            return data.data.circles;
        } catch (error: any) {
            // Handle network errors (CORS, connection refused, etc.)
            if (error.name === "TypeError" && error.message.includes("fetch")) {
                throw new Error(
                    `Cannot connect to backend server at ${API_BASE_URL}.\n\n` +
                        `Please make sure the backend is running:\n` +
                        `  cd server && npm run dev\n\n` +
                        `Or use: ./scripts/start-backend.sh`
                );
            }
            throw error;
        }
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
