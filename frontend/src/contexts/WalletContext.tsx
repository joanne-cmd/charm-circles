import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletService } from '../services/WalletService';

interface WalletContextType {
  // State
  isConnected: boolean;
  address: string | null;
  balance: number | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  getPublicKey: () => Promise<string>;
  signPSBT: (psbt: string, options?: { autoFinalized?: boolean }) => Promise<string>;
  pushPSBT: (psbt: string) => Promise<string>;
  switchNetwork: (network: 'livenet' | 'testnet') => Promise<void>;
  
  // Utilities
  formatBalance: (satoshis: number) => string;
  formatAddress: (address: string) => string;
  isWalletInstalled: () => boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [walletInstalled, setWalletInstalled] = useState<boolean>(false);

  const walletService = WalletService.getInstance();

  // Check for wallet installation on mount and periodically
  useEffect(() => {
    const checkWallet = async () => {
      // Initial check
      const installed = walletService.isWalletInstalled();
      setWalletInstalled(installed);
      
      // If not found, wait a bit for async loading
      if (!installed) {
        const found = await walletService.waitForWallet(3000);
        setWalletInstalled(found);
      }
    };

    checkWallet();
    
    // Also check periodically in case extension loads later
    const interval = setInterval(() => {
      const installed = walletService.isWalletInstalled();
      if (installed !== walletInstalled) {
        setWalletInstalled(installed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [walletInstalled]);

  // Check if wallet was previously connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (walletService.getIsConnected()) {
        const currentAddress = walletService.getAddress();
        if (currentAddress) {
          setAddress(currentAddress);
          setIsConnected(true);
          try {
            await refreshBalance();
          } catch (err) {
            console.error('Failed to refresh balance on mount:', err);
          }
        }
      }
    };

    checkConnection();
  }, []);

  const connect = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const connectedAddress = await walletService.connect();
      setAddress(connectedAddress);
      setIsConnected(true);
      await refreshBalance();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect wallet';
      setError(errorMessage);
      setIsConnected(false);
      setAddress(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = (): void => {
    walletService.disconnect();
    setIsConnected(false);
    setAddress(null);
    setBalance(null);
    setError(null);
  };

  const refreshBalance = async (): Promise<void> => {
    if (!isConnected || !address) {
      return;
    }

    try {
      const currentBalance = await walletService.getBalance();
      setBalance(currentBalance);
      setError(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch balance';
      setError(errorMessage);
      console.error('Failed to refresh balance:', err);
    }
  };

  const signPSBT = async (
    psbt: string,
    options?: { autoFinalized?: boolean }
  ): Promise<string> => {
    if (!isConnected) {
      throw new Error('Wallet is not connected');
    }

    try {
      setError(null);
      return await walletService.signPSBT(psbt, options);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign PSBT';
      setError(errorMessage);
      throw err;
    }
  };

  const pushPSBT = async (psbt: string): Promise<string> => {
    if (!isConnected) {
      throw new Error('Wallet is not connected');
    }

    try {
      setError(null);
      return await walletService.pushPSBT(psbt);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to push PSBT';
      setError(errorMessage);
      throw err;
    }
  };

  const switchNetwork = async (network: 'livenet' | 'testnet'): Promise<void> => {
    try {
      setError(null);
      await walletService.switchNetwork(network);
      // Refresh balance after network switch
      if (isConnected) {
        await refreshBalance();
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to switch network';
      setError(errorMessage);
      throw err;
    }
  };

  const formatBalance = (satoshis: number): string => {
    return walletService.formatBalance(satoshis);
  };

  const formatAddress = (address: string): string => {
    return walletService.formatAddress(address);
  };

  const isWalletInstalled = (): boolean => {
    return walletInstalled || walletService.isWalletInstalled();
  };

  const getPublicKey = async (): Promise<string> => {
    if (!isConnected) {
      throw new Error('Wallet is not connected');
    }
    try {
      setError(null);
      return await walletService.getPublicKey();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get public key';
      setError(errorMessage);
      throw err;
    }
  };

  const value: WalletContextType = {
    isConnected,
    address,
    balance,
    isLoading,
    error,
    connect,
    disconnect,
    refreshBalance,
    getPublicKey,
    signPSBT,
    pushPSBT,
    switchNetwork,
    formatBalance,
    formatAddress,
    isWalletInstalled,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

