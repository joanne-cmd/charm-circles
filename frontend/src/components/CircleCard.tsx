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

    return (
        <div className="bg-indigo-deep rounded-lg border border-cyan-accent/20 p-6 hover:border-cyan-accent/40 transition-all">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-cool mb-1">
                        Circle #{circle.circleId.slice(0, 8)}...
                    </h3>
                    <p className="text-sm text-gray-cool/70">
                        {circle.isComplete ? "Completed" : "Active"}
                    </p>
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

