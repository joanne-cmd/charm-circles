import React, { useState, useEffect } from "react";
import { CircleInfo } from "../services/CircleService";
import { useWallet } from "../contexts/WalletContext";
import { JoinCircleService, JoinCircleParams } from "../services/JoinCircleService";

interface JoinCircleModalProps {
    circle: CircleInfo;
    isOpen: boolean;
    onClose: () => void;
    onJoinStart: () => void;
    onJoinComplete: () => void;
}

export const JoinCircleModal: React.FC<JoinCircleModalProps> = ({
    circle,
    isOpen,
    onClose,
    onJoinStart,
    onJoinComplete,
}) => {
    const { address, formatBalance, getPublicKey } = useWallet();
    const [step, setStep] = useState<"confirm" | "preparing" | "broadcasting" | "success" | "error">("confirm");
    const [error, setError] = useState<string | null>(null);
    const [txid, setTxid] = useState<string | null>(null);
    const [payoutRound, setPayoutRound] = useState<number>(circle.memberCount);

    const joinService = new JoinCircleService();

    useEffect(() => {
        if (isOpen) {
            setStep("confirm");
            setError(null);
            setTxid(null);
            setPayoutRound(circle.memberCount);
        }
    }, [isOpen, circle]);

    if (!isOpen) return null;

    const handleJoin = async () => {
        if (!address) {
            setError("Wallet not connected");
            return;
        }

        try {
            setError(null);
            setStep("preparing");
            onJoinStart();

            // Get user's public key from wallet
            const userPubkey = await getPublicKey();
            
            if (!userPubkey || userPubkey.length !== 66) {
                throw new Error(`Invalid public key format. Got: ${userPubkey ? userPubkey.length : 0} characters, expected 66`);
            }

            // Fetch a fresh UTXO from the backend wallet
            // The backend will generate a new UTXO with the required amount
            const requiredAmount = circle.contributionPerRound + 2000; // contribution + tx fee buffer
            const utxoResponse = await fetch(`http://localhost:3001/api/wallet/utxos/fresh?amount=${requiredAmount}`);

            if (!utxoResponse.ok) {
                throw new Error("Failed to get funding UTXO from wallet");
            }

            const utxoData = await utxoResponse.json();
            const fundingUtxo = utxoData.data.utxo;

            const params: JoinCircleParams = {
                circleId: circle.circleId,
                joinerPubkey: userPubkey,
                fundingUtxo,
                changeAddress: address,
            };

            // Join the circle via backend API
            setStep("broadcasting");
            const response = await joinService.joinCircle(params);

            console.log("[JOIN CIRCLE] Backend response:", response);

            // Success - transaction was created and submitted
            if (response.transaction && response.transaction.length > 0) {
                console.log("[JOIN CIRCLE] Successfully joined circle");
                setTxid(response.transaction);
                setStep("success");
            } else {
                throw new Error("Backend did not return transaction data. Check server logs for details.");
            }

            // Wait a moment then close and refresh
            setTimeout(() => {
                onJoinComplete();
            }, 2000);
        } catch (err: any) {
            setError(err.message || "Failed to join circle");
            setStep("error");
            console.error("Join circle error:", err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-indigo-deep rounded-lg border border-cyan-accent/30 max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-cool">Join Circle</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-cool/70 hover:text-gray-cool"
                    >
                        ✕
                    </button>
                </div>

                {/* Circle Info */}
                <div className="mb-6 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-cool/70">Contribution:</span>
                        <span className="text-gray-cool">
                            {formatBalance(circle.contributionPerRound)} BTC
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-cool/70">Members:</span>
                        <span className="text-gray-cool">
                            {circle.memberCount} / {circle.totalRounds}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-cool/70">Current Round:</span>
                        <span className="text-gray-cool">{circle.currentRound + 1}</span>
                    </div>
                </div>

                {/* Payout Round Selection */}
                {step === "confirm" && (
                    <div className="mb-6">
                        <label className="block text-sm text-gray-cool/70 mb-2">
                            Select Payout Round (0-{circle.totalRounds - 1}):
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={circle.totalRounds - 1}
                            value={payoutRound}
                            onChange={(e) => setPayoutRound(parseInt(e.target.value, 10))}
                            className="w-full px-3 py-2 bg-midnight border border-cyan-accent/30 rounded text-gray-cool"
                        />
                    </div>
                )}

                {/* Status Messages */}
                {step === "preparing" && (
                    <div className="mb-4 text-center text-gray-cool">
                        Preparing transaction...
                    </div>
                )}

                {step === "broadcasting" && (
                    <div className="mb-4 text-center text-gray-cool">
                        Broadcasting transaction...
                    </div>
                )}

                {step === "success" && txid && (
                    <div className="mb-4 p-3 bg-green-success/20 border border-green-success/50 rounded text-green-success text-sm">
                        <p className="font-medium mb-1">Success!</p>
                        <p>Transaction: {txid.slice(0, 16)}...</p>
                    </div>
                )}

                {step === "error" && error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">
                        <p className="font-medium mb-1">Error</p>
                        <p>{error}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex space-x-3">
                    {step === "confirm" && (
                        <>
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2 bg-gray-cool/10 text-gray-cool rounded-lg hover:bg-gray-cool/20 border border-gray-cool/20"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleJoin}
                                className="flex-1 px-4 py-2 bg-cyan-accent text-midnight rounded-lg hover:bg-cyan-accent/90 font-medium"
                            >
                                Join Circle
                            </button>
                        </>
                    )}

                    {(step === "error" || step === "success") && (
                        <button
                            onClick={onClose}
                            className="w-full px-4 py-2 bg-cyan-accent text-midnight rounded-lg hover:bg-cyan-accent/90 font-medium"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

