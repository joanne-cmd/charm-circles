import React, { useState } from "react";
import { useWallet } from "../contexts/WalletContext";
import { CreateCircleService, CreateCircleParams } from "../services/CreateCircleService";
import { AddressSelector } from "./AddressSelector";

interface CreateCircleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type ContributionFrequency = "weekly" | "monthly";

export const CreateCircleModal: React.FC<CreateCircleModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
}) => {
    const { address, formatBalance, getPublicKey } = useWallet();
    const createCircleService = new CreateCircleService();
    const [step, setStep] = useState<"purpose" | "details" | "preparing" | "broadcasting" | "success" | "error">("purpose");
    const [error, setError] = useState<string | null>(null);
    const [txid, setTxid] = useState<string | null>(null);

    // Form state
    const [circlePurpose, setCirclePurpose] = useState<string>("");
    const [contributionFrequency, setContributionFrequency] = useState<ContributionFrequency>("monthly");
    const [contributionAmount, setContributionAmount] = useState<number>(100000); // satoshis
    const [maxMembers, setMaxMembers] = useState<number>(5);
    const [selectedAddress, setSelectedAddress] = useState<string>("");
    const [selectedPubkey, setSelectedPubkey] = useState<string>("");

    // Reset form when modal opens/closes
    React.useEffect(() => {
        if (isOpen) {
            setStep("purpose");
            setError(null);
            setTxid(null);
            setCirclePurpose("");
            setContributionFrequency("monthly");
            setContributionAmount(100000);
            setMaxMembers(5);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handlePurposeNext = () => {
        if (!circlePurpose.trim()) {
            setError("Please describe what this circle is for");
            return;
        }
        setStep("details");
        setError(null);
    };

    const handleCreate = async () => {
        if (!address) {
            setError("Wallet not connected");
            return;
        }

        if (contributionAmount <= 0) {
            setError("Contribution amount must be greater than 0");
            return;
        }

        if (maxMembers < 2) {
            setError("Circle must have at least 2 members");
            return;
        }

        try {
            setError(null);
            setStep("preparing");

            // Use selected public key from address selector
            const creatorPubkey = selectedPubkey || (await getPublicKey());

            if (!creatorPubkey) {
                throw new Error("Failed to get public key from wallet");
            }

            // Auto-generate fresh UTXO from backend
            console.log("[CREATE CIRCLE] Requesting fresh UTXO from backend...");
            const utxoResponse = await fetch(
                "http://localhost:3001/api/wallet/utxos/fresh?amount=2000"
            );

            if (!utxoResponse.ok) {
                const errorData = await utxoResponse.json();
                throw new Error(
                    errorData.error || "Failed to generate UTXO"
                );
            }

            const utxoData = await utxoResponse.json();
            const fundingUtxo = utxoData.data.utxo;
            const fundingUtxoValue = utxoData.data.amount;

            console.log("[CREATE CIRCLE] Auto-generated UTXO:", fundingUtxo);
            console.log("[CREATE CIRCLE] UTXO value:", fundingUtxoValue, "sats");

            // Prepare create circle parameters
            const createParams: CreateCircleParams = {
                circlePurpose,
                contributionFrequency,
                contributionAmount,
                maxMembers,
                creatorPubkey,
                fundingUtxo,
                fundingUtxoValue,
                changeAddress: address || "",
            };

            // Step 1: Prepare and submit to Charms network via backend
            // The backend runs charms spell prove which submits to Charms network
            setStep("broadcasting");
            const response = await createCircleService.prepareCreateCircle(createParams);

            console.log("[CREATE CIRCLE] Backend response:", response);

            // For Charms transactions, success means no PROVE credits error
            // Charms doesn't return a txid like Bitcoin does
            if (response.psbt && response.psbt.length > 0) {
                console.log("[CREATE CIRCLE] Transaction generated and submitted to Charms network");
                // Set a placeholder txid to indicate success
                setTxid("Submitted to Charms network");
                setStep("success");
            } else {
                throw new Error("Backend did not return transaction data. Check server logs for details.");
            }

            // Wait a moment then close and refresh
            setTimeout(() => {
                onSuccess(); // This will trigger loadCircles() in parent
                onClose();
            }, 3000); // Give user time to see success message

        } catch (err: any) {
            setError(err.message || "Failed to create circle");
            setStep("error");
            console.error("Create circle error:", err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-indigo-deep rounded-lg border border-cyan-accent/30 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-cool">Create New Circle</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-cool/70 hover:text-gray-cool text-2xl"
                    >
                        ✕
                    </button>
                </div>

                {/* Step 1: Purpose */}
                {step === "purpose" && (
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-lg font-semibold text-gray-cool mb-2">
                                What is this circle for?
                            </h4>
                            <p className="text-sm text-gray-cool/70 mb-4">
                                Describe the purpose of this savings circle. This helps members understand what they're contributing to.
                            </p>
                            <textarea
                                value={circlePurpose}
                                onChange={(e) => setCirclePurpose(e.target.value)}
                                placeholder="e.g., Emergency fund for our community, Group savings for a shared goal, Monthly savings challenge..."
                                className="w-full px-4 py-3 bg-midnight border border-cyan-accent/30 rounded-lg text-gray-cool placeholder-gray-cool/50 focus:outline-none focus:border-cyan-accent resize-none"
                                rows={4}
                            />
                        </div>

                        {/* Address Selector */}
                        <div>
                            <AddressSelector
                                onSelect={(address, pubkey) => {
                                    setSelectedAddress(address);
                                    setSelectedPubkey(pubkey);
                                }}
                                selectedAddress={selectedAddress}
                            />
                        </div>

                        {error && (
                            <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-2 rounded text-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2 bg-gray-cool/10 text-gray-cool rounded-lg hover:bg-gray-cool/20 border border-gray-cool/20"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePurposeNext}
                                className="flex-1 px-4 py-2 bg-cyan-accent text-midnight rounded-lg hover:bg-cyan-accent/90 font-medium"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Details */}
                {step === "details" && (
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-lg font-semibold text-gray-cool mb-4">
                                Circle Details
                            </h4>
                            
                            {/* Purpose Summary */}
                            <div className="mb-4 p-3 bg-midnight/50 rounded-lg border border-cyan-accent/20">
                                <p className="text-xs text-gray-cool/70 mb-1">Circle Purpose</p>
                                <p className="text-sm text-gray-cool">{circlePurpose}</p>
                            </div>

                            {/* Contribution Frequency */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-cool mb-2">
                                    Contribution Frequency
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setContributionFrequency("weekly")}
                                        className={`px-4 py-3 rounded-lg border-2 transition-all ${
                                            contributionFrequency === "weekly"
                                                ? "border-cyan-accent bg-cyan-accent/10 text-cyan-accent"
                                                : "border-cyan-accent/30 bg-midnight text-gray-cool hover:border-cyan-accent/50"
                                        }`}
                                    >
                                        <div className="font-medium">Weekly</div>
                                        <div className="text-xs opacity-70">Every 7 days</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setContributionFrequency("monthly")}
                                        className={`px-4 py-3 rounded-lg border-2 transition-all ${
                                            contributionFrequency === "monthly"
                                                ? "border-cyan-accent bg-cyan-accent/10 text-cyan-accent"
                                                : "border-cyan-accent/30 bg-midnight text-gray-cool hover:border-cyan-accent/50"
                                        }`}
                                    >
                                        <div className="font-medium">Monthly</div>
                                        <div className="text-xs opacity-70">Every 30 days</div>
                                    </button>
                                </div>
                            </div>

                            {/* Contribution Amount */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-cool mb-2">
                                    Contribution Amount per Round
                                </label>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="number"
                                        min="1000"
                                        step="1000"
                                        value={contributionAmount}
                                        onChange={(e) => setContributionAmount(parseInt(e.target.value) || 0)}
                                        className="flex-1 px-4 py-2 bg-midnight border border-cyan-accent/30 rounded-lg text-gray-cool focus:outline-none focus:border-cyan-accent"
                                    />
                                    <span className="text-sm text-gray-cool/70">satoshis</span>
                                </div>
                                <p className="text-xs text-gray-cool/60 mt-1">
                                    ≈ {formatBalance(contributionAmount)} BTC
                                </p>
                            </div>

                            {/* Max Members */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-cool mb-2">
                                    Maximum Members
                                </label>
                                <input
                                    type="number"
                                    min="2"
                                    max="20"
                                    value={maxMembers}
                                    onChange={(e) => setMaxMembers(parseInt(e.target.value) || 2)}
                                    className="w-full px-4 py-2 bg-midnight border border-cyan-accent/30 rounded-lg text-gray-cool focus:outline-none focus:border-cyan-accent"
                                />
                                <p className="text-xs text-gray-cool/60 mt-1">
                                    More members = more rounds = larger payouts
                                </p>
                            </div>

                            {/* Summary */}
                            <div className="p-4 bg-midnight/50 rounded-lg border border-cyan-accent/20">
                                <p className="text-xs text-gray-cool/70 mb-2">Circle Summary</p>
                                <div className="space-y-1 text-sm text-gray-cool">
                                    <div className="flex justify-between">
                                        <span>Frequency:</span>
                                        <span className="font-medium">{contributionFrequency === "weekly" ? "Weekly" : "Monthly"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Amount per round:</span>
                                        <span className="font-medium">{formatBalance(contributionAmount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Max members:</span>
                                        <span className="font-medium">{maxMembers}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-cyan-accent/20">
                                        <span>Total rounds:</span>
                                        <span className="font-medium">{maxMembers}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-2 rounded text-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setStep("purpose")}
                                className="flex-1 px-4 py-2 bg-gray-cool/10 text-gray-cool rounded-lg hover:bg-gray-cool/20 border border-gray-cool/20"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!address}
                                className="flex-1 px-4 py-2 bg-cyan-accent text-midnight rounded-lg hover:bg-cyan-accent/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                Create Circle
                            </button>
                        </div>
                    </div>
                )}

                {/* Status Messages */}
                {step === "preparing" && (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-accent mx-auto mb-4"></div>
                        <p className="text-gray-cool">Preparing circle creation...</p>
                    </div>
                )}

                {step === "broadcasting" && (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-accent mx-auto mb-4"></div>
                        <p className="text-gray-cool">Broadcasting transaction...</p>
                    </div>
                )}

                {step === "success" && txid && (
                    <div className="text-center py-8">
                        <div className="text-6xl mb-4">✅</div>
                        <p className="text-xl font-semibold text-green-success mb-2">Circle Created!</p>
                        <p className="text-sm text-gray-cool/70 mb-4">
                            Transaction: {txid.slice(0, 16)}...
                        </p>
                        <div className="bg-cyan-accent/10 border border-cyan-accent/30 rounded-lg p-4 mt-4">
                            <p className="text-sm text-cyan-accent mb-2">
                                ⏳ Waiting for confirmation...
                            </p>
                            <p className="text-xs text-gray-cool/70">
                                Your circle will appear in the list once the transaction is confirmed on Bitcoin (usually 1-10 minutes). Click "Refresh" to check for updates.
                            </p>
                        </div>
                    </div>
                )}

                {step === "error" && error && (
                    <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded text-sm">
                        <p className="font-medium mb-1">Error</p>
                        <p>{error}</p>
                        <button
                            onClick={() => setStep("details")}
                            className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded text-sm"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};


