import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';

export const Header: React.FC = () => {
  const {
    isConnected,
    address,
    balance,
    isLoading,
    error,
    connect,
    disconnect,
    refreshBalance,
    formatBalance,
    formatAddress,
    isWalletInstalled,
  } = useWallet();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      // Error is already handled in the context
      console.error('Connection error:', err);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleRefreshBalance = async () => {
    setIsRefreshing(true);
    try {
      await refreshBalance();
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const walletInstalled = isWalletInstalled();

  return (
    <header className="bg-indigo-deep shadow-lg border-b border-cyan-accent/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-cool">CharmCircle</h1>
          </div>

          {/* Wallet Connection Section */}
          <div className="flex items-center space-x-4">
            {error && (
              <div className="hidden sm:block">
                <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-3 py-1 rounded-md text-sm">
                  {error}
                </div>
              </div>
            )}

            {isConnected && address ? (
              <div className="flex items-center space-x-3">
                {/* Address Display */}
                <div className="hidden sm:flex flex-col items-end">
                  <div className="text-sm font-medium text-gray-cool">
                    {formatAddress(address)}
                  </div>
                  {balance !== null && (
                    <div className="text-xs text-gray-cool/70">
                      {formatBalance(balance)} BTC
                    </div>
                  )}
                </div>

                {/* Mobile Address Display */}
                <div className="sm:hidden flex flex-col items-end">
                  <div className="text-xs font-medium text-gray-cool">
                    {formatAddress(address)}
                  </div>
                  {balance !== null && (
                    <div className="text-xs text-gray-cool/70">
                      {formatBalance(balance)} BTC
                    </div>
                  )}
                </div>

                {/* Refresh Balance Button */}
                <button
                  onClick={handleRefreshBalance}
                  disabled={isRefreshing}
                  className="p-2 text-gray-cool/70 hover:text-cyan-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Refresh balance"
                >
                  <svg
                    className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>

                {/* Disconnect Button */}
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-gray-cool/10 text-gray-cool rounded-lg hover:bg-gray-cool/20 border border-gray-cool/20 transition-colors text-sm font-medium"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isLoading || !walletInstalled}
                className="px-4 py-2 bg-cyan-accent text-midnight rounded-lg hover:bg-cyan-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Connecting...</span>
                  </>
                ) : !walletInstalled ? (
                  <>
                    <span>Install UniSat</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </>
                ) : (
                  <span>Connect Wallet</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error Message for Mobile */}
        {error && (
          <div className="sm:hidden pb-4">
            <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Wallet Not Installed Message */}
        {!walletInstalled && !isConnected && (
          <div className="pb-4">
            <div className="bg-cyan-accent/10 border border-cyan-accent/30 text-cyan-accent px-4 py-3 rounded-md text-sm">
              <p className="font-medium mb-1">UniSat Wallet Required</p>
              <p>
                Please install{' '}
                <a
                  href="https://unisat.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-cyan-accent/80"
                >
                  UniSat wallet
                </a>{' '}
                to use this application.
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

