import React from "react";
import { CircleInfo, CircleService } from "../services/CircleService";

interface CircleCardProps {
    circle: CircleInfo;
    onJoin: (circle: CircleInfo) => void;
    isJoining?: boolean;
    canJoin: boolean;
}

export const CircleCard: React.FC<CircleCardProps> = ({
    circle,
    onJoin,
    isJoining = false,
    canJoin,
}) => {
    const circleService = new CircleService();
    const isFull = circle.memberCount >= circle.totalRounds;
    const progress = (circle.memberCount / circle.totalRounds) * 100;
    const timeRemaining = circleService.getRoundTimeRemaining(circle);
    const [showMembers, setShowMembers] = React.useState(false);
    const [copiedPubkey, setCopiedPubkey] = React.useState<string | null>(null);

    const shortenPubkey = (pubkey: string) => {
        if (pubkey.length <= 12) return pubkey;
        return `${pubkey.slice(0, 6)}...${pubkey.slice(-6)}`;
    };

    const copyToClipboard = (pubkey: string) => {
        navigator.clipboard.writeText(pubkey);
        setCopiedPubkey(pubkey);
        setTimeout(() => setCopiedPubkey(null), 2000);
    };

    return (
        <div className="bg-indigo-deep rounded-lg border border-cyan-accent/20 p-6 hover:border-cyan-accent/40 transition-all">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-cool mb-1">
                        {circle.purpose || `Circle #${circle.circleId.slice(0, 8)}...`}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-gray-cool/70">
                            {circle.isComplete ? "Completed" : "Active"}
                        </p>
                        {circle.frequency && (
                            <>
                                <span className="text-gray-cool/50">•</span>
                                <p className="text-sm text-gray-cool/70 capitalize">
                                    {circle.frequency}
                                </p>
                            </>
                        )}
                    </div>
                </div>
                {!circle.isComplete && (
                    <span className="px-2 py-1 bg-cyan-accent/20 text-cyan-accent text-xs rounded">
                        Round {circle.currentRound + 1}/{circle.totalRounds}
                    </span>
                )}
            </div>

            {/* Members Progress */}
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-cool/80">Members</span>
                    <span className="text-gray-cool">
                        {circle.memberCount} / {circle.totalRounds}
                    </span>
                </div>
                <div className="w-full bg-midnight rounded-full h-2">
                    <div
                        className="bg-cyan-accent h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Members List */}
            {circle.members && circle.members.length > 0 && (
                <div className="mb-4">
                    <button
                        type="button"
                        onClick={() => setShowMembers(!showMembers)}
                        className="text-sm text-gray-cool/70 hover:text-gray-cool mb-2 flex items-center gap-1"
                    >
                        <span>{showMembers ? "▼" : "▶"}</span>
                        <span>
                            {showMembers ? "Hide" : "Show"} Members ({circle.members.length})
                        </span>
                    </button>
                    {showMembers && (
                        <div className="space-y-2 mt-2">
                            {circle.members.map((member) => (
                                <div
                                    key={member.pubkey}
                                    className="flex items-center justify-between text-xs bg-midnight/50 rounded p-2"
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-gray-cool/70 flex-shrink-0">
                                            Round {member.payoutRound}
                                        </span>
                                        <code className="text-cyan-accent/80 truncate flex-1">
                                            {shortenPubkey(member.pubkey)}
                                        </code>
                                        {member.hasReceivedPayout && (
                                            <span className="text-green-success flex-shrink-0">✓</span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(member.pubkey)}
                                        className="ml-2 px-2 py-1 text-gray-cool/60 hover:text-cyan-accent transition-colors flex-shrink-0"
                                        title="Copy full public key"
                                    >
                                        {copiedPubkey === member.pubkey ? "✓" : "📋"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Contribution Amount */}
            <div className="mb-4">
                <div className="text-sm text-gray-cool/70 mb-1">
                    Contribution per Round
                </div>
                <div className="text-lg font-semibold text-gray-cool">
                    {circleService.formatContribution(circle.contributionPerRound)}
                </div>
            </div>

            {/* Current Pool */}
            {circle.currentPool > 0 && (
                <div className="mb-4">
                    <div className="text-sm text-gray-cool/70 mb-1">
                        Current Pool
                    </div>
                    <div className="text-base font-medium text-green-success">
                        {circleService.formatContribution(circle.currentPool)}
                    </div>
                </div>
            )}

            {/* Round Time */}
            {!circle.isComplete && timeRemaining > 0 && (
                <div className="mb-4 text-sm text-gray-cool/70">
                    Time remaining: {circleService.formatTimeRemaining(timeRemaining)}
                </div>
            )}

            {/* Join Button */}
            {canJoin && !isFull && !circle.isComplete && (
                <button
                    onClick={() => onJoin(circle)}
                    disabled={isJoining}
                    className="w-full px-4 py-2 bg-cyan-accent text-midnight rounded-lg hover:bg-cyan-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                    {isJoining ? "Joining..." : "Join Circle"}
                </button>
            )}

            {!canJoin && !isFull && !circle.isComplete && (
                <div className="text-xs text-gray-cool/60 text-center py-2">
                    Connect wallet to join
                </div>
            )}

            {isFull && (
                <div className="text-sm text-gray-cool/70 text-center py-2">
                    Circle is full
                </div>
            )}

            {circle.isComplete && (
                <div className="text-sm text-green-success text-center py-2">
                    Circle completed
                </div>
            )}
        </div>
    );
};

