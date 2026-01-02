import React, { useState, useEffect } from "react";
import { CircleCard } from "./CircleCard";
import { CircleInfo, CircleService } from "../services/CircleService";
import { useWallet } from "../contexts/WalletContext";
import { JoinCircleModal } from "./JoinCircleModal";
import { CreateCircleModal } from "./CreateCircleModal";

export const CircleGrid: React.FC = () => {
    const [circles, setCircles] = useState<CircleInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCircle, setSelectedCircle] = useState<CircleInfo | null>(null);
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [joiningCircleId, setJoiningCircleId] = useState<string | null>(null);

    const { isConnected } = useWallet();
    const circleService = new CircleService();

    useEffect(() => {
        loadCircles();
    }, []);

    const loadCircles = async () => {
        try {
            setLoading(true);
            setError(null);
            const discoveredCircles = await circleService.discoverCircles();
            setCircles(discoveredCircles);
        } catch (err: any) {
            setError(err.message || "Failed to load circles");
            console.error("Error loading circles:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = (circle: CircleInfo) => {
        if (!isConnected) {
            alert("Please connect your wallet first");
            return;
        }
        setSelectedCircle(circle);
        setIsJoinModalOpen(true);
    };

    const handleJoinComplete = () => {
        setIsJoinModalOpen(false);
        setSelectedCircle(null);
        setJoiningCircleId(null);
        // Reload circles to show updated member count
        // Note: Changes may take a few minutes to appear after Bitcoin confirmation
        setTimeout(() => {
            loadCircles();
        }, 2000); // Wait a bit before refreshing
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="text-gray-cool">Loading circles...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-md">
                <p className="font-medium mb-1">Error loading circles</p>
                <p className="text-sm">{error}</p>
                <button
                    onClick={loadCircles}
                    className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-sm"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (circles.length === 0) {
        return (
            <>
                <div className="text-center py-12">
                    <p className="text-gray-cool/70 mb-6 text-lg">
                        No active circles found. Be the first to create one!
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            disabled={!isConnected}
                            className="px-6 py-3 bg-cyan-accent text-midnight rounded-lg hover:bg-cyan-accent/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
                        >
                            {isConnected ? "Create New Circle" : "Connect Wallet to Create"}
                        </button>
                        <button
                            onClick={loadCircles}
                            className="px-6 py-3 bg-indigo-deep border border-cyan-accent/30 text-gray-cool rounded-lg hover:border-cyan-accent/50 transition-colors"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
                <CreateCircleModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => {
                        setIsCreateModalOpen(false);
                        loadCircles();
                    }}
                />
            </>
        );
    }

    return (
        <>
            <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-gray-cool">
                    Available Circles ({circles.length})
                </h2>
                <div className="flex gap-3">
                    {isConnected && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-4 py-2 bg-cyan-accent text-midnight rounded-lg hover:bg-cyan-accent/90 font-medium"
                        >
                            + Create Circle
                        </button>
                    )}
                    <button
                        onClick={loadCircles}
                        className="px-4 py-2 bg-indigo-deep border border-cyan-accent/30 text-gray-cool rounded-lg hover:border-cyan-accent/50 transition-colors"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {circles.map((circle) => (
                    <CircleCard
                        key={circle.utxo}
                        circle={circle}
                        onJoin={handleJoin}
                        isJoining={joiningCircleId === circle.utxo}
                        canJoin={isConnected}
                    />
                ))}
            </div>

            {selectedCircle && (
                <JoinCircleModal
                    circle={selectedCircle}
                    isOpen={isJoinModalOpen}
                    onClose={() => {
                        setIsJoinModalOpen(false);
                        setSelectedCircle(null);
                    }}
                    onJoinStart={() => setJoiningCircleId(selectedCircle.utxo)}
                    onJoinComplete={handleJoinComplete}
                />
            )}

            <CreateCircleModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    loadCircles();
                }}
            />
        </>
    );
};

